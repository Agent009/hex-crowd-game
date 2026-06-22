import React, { useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { selectTile } from '../store/worldSlice';
import { GameScene } from '../game/GameEngine';
import { CubeCoords } from '../utils/hexGrid';
import { disasterData } from '../data/gameData';
import { TerrainType } from '../data/gameData';
import { GameConfig } from '../game/GameConfig';

interface GameCanvasProps {
  className?: string;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ className }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const dispatch = useDispatch();

  const { tiles } = useSelector((state: RootState) => state.world);
  const { showPlayerNumbers } = useSelector((state: RootState) => state.ui);
  const { activityEvents, heroes, players } = useSelector((state: RootState) => state.game);
  const seenVfxIdsRef = useRef<Set<string>>(new Set());
  const vfxInitializedRef = useRef(false);
  // Keep a live handle to player positions so the VFX effect can resolve a
  // tile for events that only carry a playerId, without re-running on moves.
  const playersRef = useRef(players);
  playersRef.current = players;
  // Live handle to tiles so disaster events can resolve all tiles of a terrain
  // without the VFX effect re-running every time the board changes.
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  // Last-known active state per tile, to detect active→inactive transitions
  // (e.g. a tile harvested dry) and play the depletion flip exactly once.
  const prevActiveRef = useRef<Record<string, boolean>>({});

  // Memoized event handlers to prevent recreation on every render
  const handleTileClick = useCallback((coords: CubeCoords) => {
    // Select the tile for party game
    dispatch(selectTile(coords));
  }, [dispatch]);

  const handleTileHover = useCallback(() => {
    // Handle hover for party game (currently unused)
  }, []);

  // Initialize Phaser game
  useEffect(() => {
    let pollTimerId: ReturnType<typeof setTimeout> | null = null;

    if (!gameRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container',
        backgroundColor: GameConfig.camera.backgroundColor,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
          antialias: true,
          pixelArt: false,
        },
        scene: GameScene
      };

      try {
        gameRef.current = new Phaser.Game(config);
      } catch (error) {
        console.error('Failed to initialize Phaser game:', error);
        return;
      }

      let pollAttempts = 0;

      const checkForScene = () => {
        pollAttempts++;
        if (gameRef.current && gameRef.current.scene.isActive('GameScene')) {
          sceneRef.current = gameRef.current.scene.getScene('GameScene') as GameScene;

          if (sceneRef.current) {
            sceneRef.current.initializeScene({
              tiles,
              heroes,
              onTileClick: handleTileClick,
              onTileHover: handleTileHover,
              showPlayerNumbers
            });
          }
        } else if (pollAttempts < GameConfig.canvas.maxPollAttempts) {
          pollTimerId = setTimeout(checkForScene, GameConfig.canvas.pollingIntervalMs);
        }
      };

      checkForScene();
    }

    return () => {
      if (pollTimerId !== null) {
        clearTimeout(pollTimerId);
      }

      if (gameRef.current) {
        // Properly shut down the scene before destroying the game
        if (sceneRef.current && sceneRef.current.scene.isActive()) {
          // Call any custom cleanup in your scene
          try {
            if (typeof sceneRef.current.cleanup === 'function') {
              sceneRef.current.cleanup();
            }
            // This will call the custom destroy method in GameScene
            gameRef.current.scene.remove('GameScene');
          } catch (error) {
            console.error('Error shutting down scene:', error);
          }
        }

        // Now destroy the entire game instance
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Handle window resize with debounce
  useEffect(() => {
    let resizeTimerId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (resizeTimerId !== null) clearTimeout(resizeTimerId);
      resizeTimerId = setTimeout(() => {
        if (gameRef.current) {
          gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
        }
      }, GameConfig.canvas.resizeDebounceMs);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerId !== null) clearTimeout(resizeTimerId);
    };
  }, []);

  // Update tiles when Redux state changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene && scene.scene.isActive()) {
      // Re-render first so the depleted face exists, then flip it into view.
      scene.updateTiles(tiles);

      const prev = prevActiveRef.current;
      const isFirst = Object.keys(prev).length === 0;
      if (!isFirst) {
        Object.entries(tiles).forEach(([key, tile]) => {
          const wasActive = prev[key];
          const nowActive = tile.isActive !== false;
          if (wasActive === true && !nowActive) {
            scene.triggerTileFlip(tile.coords);
          }
        });
      }
    }
    // Snapshot active state for the next diff (also on first run / restore).
    const snapshot: Record<string, boolean> = {};
    Object.entries(tiles).forEach(([key, tile]) => {
      snapshot[key] = tile.isActive !== false;
    });
    prevActiveRef.current = snapshot;
  }, [tiles]);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.updateHeroes(heroes);
    }
  }, [heroes]);

  // Update player numbers visibility when setting changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.setPlayerNumbersVisibility(showPlayerNumbers);
    }
  }, [showPlayerNumbers]);
  
  // Update event handlers when they change
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.updateEventHandlers({
        onTileClick: handleTileClick,
        onTileHover: handleTileHover
      });
    }
  }, [handleTileClick, handleTileHover]);

  // Board-level feedback driven by new activity events: floating damage & heal
  // numbers, combat clashes, terrain-effect ticks and disaster animations.
  // A single seen-set dedupes everything so each event fires its VFX exactly
  // once, even across re-renders and state-syncs.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.scene.isActive()) return;

    const seen = seenVfxIdsRef.current;

    // On first run (mount / state restore) seed the seen-set so we don't replay
    // the whole backlog of events as animations.
    if (!vfxInitializedRef.current) {
      activityEvents.forEach((e) => seen.add(e.id));
      vfxInitializedRef.current = true;
      return;
    }

    const resolveCoords = (event: typeof activityEvents[number]): CubeCoords | null => {
      if (event.details?.coords) return event.details.coords;
      if (event.playerId) {
        const player = playersRef.current.find((p) => p.id === event.playerId);
        if (player) return player.position;
      }
      return null;
    };

    // The main disaster event carries `affectedPlayers`; play the full
    // terrain-wide animation (sprite + particles + shake) for it once.
    const triggerDisaster = (event: typeof activityEvents[number]): void => {
      const details = event.details;
      if (!details || !details.disaster || !details.terrain) return;
      if (!('affectedPlayers' in details)) return;

      const entry = Object.entries(disasterData).find(
        ([, data]) => data.name === details.disaster
      );
      if (!entry) return;
      const [disasterId] = entry;

      const affectedTiles: CubeCoords[] = Object.values(tilesRef.current)
        .filter((tile) => tile.terrain === (details.terrain as TerrainType))
        .map((tile) => tile.coords);

      if (affectedTiles.length > 0) {
        scene.triggerDisasterAnimation(disasterId, affectedTiles);
      }
    };

    // Events are newest-first; collect just the unseen ones and cap the burst.
    // The cap is generous enough that a single disaster batch (one "struck"
    // event plus per-player damage events on a crowded terrain) is never
    // truncated, which would otherwise drop the terrain-wide animation.
    const fresh = activityEvents.filter((e) => !seen.has(e.id));
    fresh.slice(0, 24).reverse().forEach((event) => {
      const coords = resolveCoords(event);

      switch (event.type) {
        case 'combat':
          if (event.details?.coords) {
            scene.triggerCombatClash(event.details.coords);
          }
          if (coords && event.details?.damage) {
            scene.triggerFloatingNumber(coords, `-${event.details.damage}`, '#fca5a5');
          }
          break;
        case 'damage':
          if (coords && event.details?.damage) {
            scene.triggerFloatingNumber(coords, `-${event.details.damage}`, '#f87171');
          }
          break;
        case 'terrain_effect':
          if (coords && event.details?.damage) {
            scene.triggerFloatingNumber(coords, `-${event.details.damage}`, '#fda4af');
          }
          break;
        case 'healing':
          if (coords && event.details?.healing) {
            scene.triggerFloatingNumber(coords, `+${event.details.healing}`, '#86efac');
          }
          break;
        case 'disaster':
          // Per-player disaster damage shows a floating number...
          if (coords && event.details?.damage) {
            scene.triggerFloatingNumber(coords, `-${event.details.damage}`, '#fb923c');
          }
          // ...while the terrain-wide "struck" event drives the big animation.
          triggerDisaster(event);
          break;
        default:
          break;
      }
    });

    activityEvents.forEach((e) => seen.add(e.id));
    // Bound the set so it can't grow without limit over a long game.
    if (seen.size > 400) {
      const keep = new Set(activityEvents.map((e) => e.id));
      seenVfxIdsRef.current = keep;
    }
  }, [activityEvents]);
  
  return (
    <div 
      id="game-container" 
      data-testid="game-canvas"
      className={`relative w-full h-full bg-slate-950 ${className}`}
      style={{ minHeight: `${GameConfig.canvas.minHeight}px` }}
    />
  );
};

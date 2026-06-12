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
  const lastDisasterEventIdRef = useRef<string | null>(null);
  const seenVfxIdsRef = useRef<Set<string>>(new Set());
  const vfxInitializedRef = useRef(false);
  // Keep a live handle to player positions so the VFX effect can resolve a
  // tile for events that only carry a playerId, without re-running on moves.
  const playersRef = useRef(players);
  playersRef.current = players;

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
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.updateTiles(tiles);
    }
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

  // Trigger disaster animations when disaster events occur
  useEffect(() => {
    if (!sceneRef.current || !sceneRef.current.scene.isActive()) return;

    // Find new disaster events
    const disasterEvents = activityEvents.filter(
      (event) =>
        event.type === 'disaster' &&
        event.id !== lastDisasterEventIdRef.current &&
        event.details &&
        'disaster' in event.details &&
        'terrain' in event.details
    );

    disasterEvents.forEach((event) => {
      if (!event.details || typeof event.details !== 'object') return;

      const disasterName = (event.details as { disaster?: string }).disaster;
      const terrain = (event.details as { terrain?: string }).terrain;

      if (!disasterName || !terrain) return;

      // Find disaster ID from name
      const disasterEntry = Object.entries(disasterData).find(
        ([, data]) => data.name === disasterName
      );

      if (!disasterEntry) return;

      const [disasterId] = disasterEntry;

      // Get all tiles affected by this disaster (same terrain)
      const affectedTiles: CubeCoords[] = Object.values(tiles)
        .filter((tile) => tile.terrain === (terrain as TerrainType))
        .map((tile) => tile.coords);

      if (affectedTiles.length > 0) {
        // Trigger animation
        sceneRef.current?.triggerDisasterAnimation(disasterId, affectedTiles);
        lastDisasterEventIdRef.current = event.id;
      }
    });
  }, [activityEvents, tiles]);

  // Board-level combat / ability feedback: floating damage & heal numbers and
  // combat clash effects, driven by new activity events.
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

    // Events are newest-first; collect just the unseen ones and cap the burst.
    const fresh = activityEvents.filter((e) => !seen.has(e.id));
    fresh.slice(0, 8).reverse().forEach((event) => {
      const coords = resolveCoords(event);
      if (!coords) return;

      switch (event.type) {
        case 'combat':
          if (event.details?.coords) {
            scene.triggerCombatClash(event.details.coords);
          }
          if (event.details?.damage) {
            scene.triggerFloatingNumber(coords, `-${event.details.damage}`, '#fca5a5');
          }
          break;
        case 'damage':
          if (event.details?.damage) {
            scene.triggerFloatingNumber(coords, `-${event.details.damage}`, '#f87171');
          }
          break;
        case 'healing':
          if (event.details?.healing) {
            scene.triggerFloatingNumber(coords, `+${event.details.healing}`, '#86efac');
          }
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

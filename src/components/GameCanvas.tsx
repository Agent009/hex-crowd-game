import React, { useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { selectTile } from '../store/worldSlice';
import { GameScene } from '../game/GameEngine';
import { CubeCoords } from '../utils/hexGrid';
import { disasterData } from '../data/gameData';
import { TerrainType } from '../data/gameData';

interface GameCanvasProps {
  className?: string;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ className }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const dispatch = useDispatch();

  const { tiles, activeTiles } = useSelector((state: RootState) => state.world);
  const { showPlayerNumbers } = useSelector((state: RootState) => state.ui);
  const { activityEvents } = useSelector((state: RootState) => state.game);
  const lastDisasterEventIdRef = useRef<string | null>(null);

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
        backgroundColor: '#2D5016',
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

      const MAX_POLL_ATTEMPTS = 50;
      let pollAttempts = 0;

      // Use a safer approach to wait for the scene to be ready
      const checkForScene = () => {
        pollAttempts++;
        if (gameRef.current && gameRef.current.scene.isActive('GameScene')) {
          sceneRef.current = gameRef.current.scene.getScene('GameScene') as GameScene;

          if (sceneRef.current) {
            // Initialize scene with current game state
            sceneRef.current.initializeScene({
              tiles,
              onTileClick: handleTileClick,
              onTileHover: handleTileHover,
              showPlayerNumbers
            });
          }
        } else if (pollAttempts < MAX_POLL_ATTEMPTS) {
          pollTimerId = setTimeout(checkForScene, 100);
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

  // Update tiles when Redux state changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.updateTiles(tiles);
    }
  }, [tiles]);

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
  
  return (
    <div 
      id="game-container" 
      className={`relative w-full h-full bg-green-900 ${className}`}
      style={{ minHeight: '600px' }}
    />
  );
};

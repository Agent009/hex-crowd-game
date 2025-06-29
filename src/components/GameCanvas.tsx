import React, { useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { selectTile } from '../store/gameSlice';
import { GameScene } from '../game/GameEngine';
import { CubeCoords, coordsToKey, coordsEqual } from '../utils/hexGrid';

interface GameCanvasProps {
  className?: string;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ className }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const lastResourceCollectionRef = useRef<{ [key: string]: boolean }>({});
  const lastExplorationRef = useRef<{ [key: string]: boolean }>({});
  const lastBuildingCompletionRef = useRef<{ [key: string]: number }>({});
  const dispatch = useDispatch();

  const { tiles, selectedTile, selectedHero, heroes, showFogOfWar } = useSelector((state: RootState) => state.game);

  // Memoized event handlers to prevent recreation on every render
  const handleTileClick = useCallback((coords: CubeCoords) => {
    const key = coordsToKey(coords);
    const tile = tiles[key];

    // Prevent interaction with tiles in dense fog
    if (showFogOfWar && tile && tile.fogLevel === 0) {
      return;
    }

    // Only select the tile, don't move the hero automatically
    dispatch(selectTile(coords));
  }, [dispatch, tiles, showFogOfWar, selectedHero, selectedTile, heroes]);

  const handleTileHover = useCallback((coords: CubeCoords | null) => {
    if (coords) {
      const key = coordsToKey(coords);
      const tile = tiles[key];

      // Only show hover effects for visible tiles
      if (!showFogOfWar || (tile && tile.fogLevel > 0)) {
        // Could show tile info tooltip here
      }
    }
  }, [tiles, showFogOfWar]);

  // Initialize Phaser game
  useEffect(() => {
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

      gameRef.current = new Phaser.Game(config);

      // Use a safer approach to wait for the scene to be ready
      const checkForScene = () => {
        if (gameRef.current && gameRef.current.scene.isActive('GameScene')) {
          sceneRef.current = gameRef.current.scene.getScene('GameScene') as GameScene;

          if (sceneRef.current) {
            // Initialize scene with current game state
            sceneRef.current.initializeScene({
              tiles,
              onTileClick: handleTileClick,
              onTileHover: handleTileHover,
              showFogOfWar
            });
          }
        } else {
          // Try again in a short while
          setTimeout(checkForScene, 100);
        }
      };

      checkForScene();

      // Wait for scene to be ready
      // gameRef.current.events.once('ready', () => {
      // Wait for scene to be fully started
      // gameRef.current.scene.getScene('GameScene').events.once('start', () => {
      // Wait for scene to be fully created and started
      // gameRef.current.scene.getScene('GameScene').events.once('create', () => {
      //   sceneRef.current = gameRef.current?.scene.getScene('GameScene') as GameScene;
      //
      //   if (sceneRef.current) {
      //     // Initialize scene with current game state
      //     sceneRef.current.initializeScene({
      //       tiles,
      //       onTileClick: handleTileClick,
      //       onTileHover: handleTileHover,
      //       showFogOfWar
      //     });
      //   }
      // });
    }

    return () => {
      if (gameRef.current) {
        // Properly shut down the scene before destroying the game
        if (sceneRef.current && sceneRef.current.scene.isActive()) {
          // Call any custom cleanup in your scene
          try {
            // Call our custom cleanup method first
            if (typeof sceneRef.current.cleanup === 'function') {
              sceneRef.current.cleanup();
            }

            // This will call your custom destroy method in GameScene
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
  }, []); // Empty dependency array - only run once

  // Update tiles when Redux state changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.updateTiles(tiles);

      // Check for resource discoveries and trigger animations
      Object.entries(tiles).forEach(([key, tile]) => {
        if (tile.resource && tile.resourceDepleted && !lastResourceCollectionRef.current[key]) {
          // Resource was just collected
          lastResourceCollectionRef.current[key] = true;
          sceneRef.current?.triggerResourceDiscovery(tile.coords, tile.resource, 100);
        }

        if (tile.explored && tile.visible && tile.fogLevel > 0 && !lastExplorationRef.current[key]) {
          // Resource was just collected
          lastExplorationRef.current[key] = true;
          sceneRef.current?.triggerExplorationEffect(tile.coords);
        }
      });

      // Check for building completions
      // This would need to be integrated with the building system
      // For now, we'll trigger on building placement
    }
  }, [tiles]);

  // Monitor building completions
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      Object.entries(tiles).forEach(([key, tile]) => {
        if (tile.building && !coordsEqual(tile.coords, { q: 0, r: 0, s: 0 }) && !lastBuildingCompletionRef.current[key]) {
          // Building was just completed/placed
          lastBuildingCompletionRef.current[key] = 1;
          sceneRef.current?.triggerConstructionCompletion(tile.coords, tile.building, 1);
        }
      });
    }
  }, [tiles]);
  
  // Update fog of war when setting changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.setFogOfWar(showFogOfWar);
    }
  }, [showFogOfWar]);
  
  // Update event handlers when they change
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene.isActive()) {
      sceneRef.current.updateEventHandlers({
        onTileClick: handleTileClick,
        onTileHover: handleTileHover
      });
    }
  }, [handleTileClick, handleTileHover]);
  
  return (
    <div 
      id="game-container" 
      className={`relative w-full h-full bg-green-900 ${className}`}
      style={{ minHeight: '600px' }}
    />
  );
};

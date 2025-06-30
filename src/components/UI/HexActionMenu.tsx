import React from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import {movePlayer, selectTile, toggleTileInfo} from '../../store/gameSlice';
import {cubeToPixel, DEFAULT_HEX_SIZE, coordsToKey, areAdjacent} from '../../utils/hexGrid';
import {terrainData} from '../../data/gameData';
import {
  MapPin,
  Package,
  Hammer,
  Info,
  Move,
  Sparkles
} from 'lucide-react';

interface HexActionMenuProps {
  onOpenHarvestGrid: (tab: 'resources' | 'items' | 'crafting') => void;
  onOpenTileInfo: () => void;
}

export const HexActionMenu: React.FC<HexActionMenuProps> = ({
                                                              onOpenHarvestGrid,
                                                              onOpenTileInfo
                                                            }) => {
  const dispatch = useDispatch();
  const {
    selectedTile,
    tiles,
    currentPlayer,
    playerStats,
    activeTiles,
    currentPhase,
    showPhaseOverlay
  } = useSelector((state: RootState) => state.game);

  // Hide menu when phase overlay is shown
  if (!selectedTile || showPhaseOverlay) return null;

  const tileKey = coordsToKey(selectedTile);
  const tile = tiles[tileKey];

  if (!tile) return null;

  const currentPlayerStats = currentPlayer ? playerStats[currentPlayer.id] : null;
  const isPlayerOnTile = tile?.players?.some(p => p.id === currentPlayer?.id);
  const isActive = activeTiles.includes(tileKey);
  const terrain = terrainData[tile?.terrain || 'plains'];

  const canMove = () => {
    if (!currentPlayer || !currentPlayerStats || currentPhase !== 'interaction') return false;
    if (isPlayerOnTile) return false;

    // Check if tile is adjacent to current position
    if (!areAdjacent(currentPlayer.position, selectedTile)) return false;

    let movementCost = terrain.moveCost || 1;
    if (terrain.requiredItem) {
      const hasRequiredItem = currentPlayerStats.items.some(item => item.id === terrain.requiredItem);
      if (!hasRequiredItem) {
        movementCost = terrain.alternativeAPCost || (terrain.moveCost + 1);
      }
    }

    return currentPlayerStats.actionPoints >= movementCost;
  };

  const canHarvest = () => {
    return currentPlayer && currentPlayerStats && isPlayerOnTile && isActive && currentPhase === 'interaction';
  };

  const canCraft = () => {
    return currentPlayer && currentPlayerStats && currentPhase === 'interaction';
  };

  const handleMove = () => {
    if (currentPlayer && canMove()) {
      dispatch(movePlayer({
        playerId: currentPlayer.id,
        target: selectedTile
      }));
      // Clear selection after successful move
      dispatch(selectTile(null));
    }
  };

  const handleAction = (actionFn: () => void, keepMenuActive: boolean = false) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      actionFn();
      // Clear selection after action unless we want to keep menu active
      if (!keepMenuActive) {
        dispatch(selectTile(null));
      }
    };
  };

  const enableHarvestResource = canHarvest() && currentPlayerStats!.actionPoints >= 1;
  const enableHarvestItem = canHarvest() && currentPlayerStats!.actionPoints >= 3;

  const actions = [
    {
      id: 'move',
      icon: Move,
      label: canMove() ? 'Move Here' : 'Cannot Move Here',
      color: 'bg-blue-600 hover:bg-blue-700',
      enabled: canMove(),
      onClick: handleAction(handleMove),
      angle: -90 // Top
    },
    {
      id: 'harvest-resource',
      icon: Package,
      label: enableHarvestResource ? 'Harvest Resource (1 AP)' : 'Harvest Resource (need 1 AP)',
      color: 'bg-green-600 hover:bg-green-700',
      enabled: enableHarvestResource,
      onClick: handleAction(() => onOpenHarvestGrid('resources'), true),
      angle: -30 // Top right
    },
    {
      id: 'harvest-item',
      icon: Sparkles,
      label: enableHarvestItem ? 'Harvest Item (3 AP)' : 'Harvest Item (need 3 AP)',
      color: 'bg-purple-600 hover:bg-purple-700',
      enabled: enableHarvestItem,
      onClick: handleAction(() => onOpenHarvestGrid('items'), true),
      angle: 30 // Bottom right
    },
    {
      id: 'craft',
      icon: Hammer,
      label: canCraft() ? 'Craft Item' : 'Cannot Craft Item',
      color: 'bg-orange-600 hover:bg-orange-700',
      enabled: canCraft(),
      onClick: handleAction(() => onOpenHarvestGrid('crafting'), true),
      angle: 90 // Bottom
    },
    {
      id: 'info',
      icon: Info,
      label: 'Tile Info',
      color: 'bg-slate-600 hover:bg-slate-700',
      enabled: true,
      onClick: handleAction(() => dispatch(toggleTileInfo()), true),
      angle: 150 // Bottom left
    }
  ];

  // Calculate screen position more reliably
  const getScreenPosition = () => {
    // Get the game container
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return {x: 0, y: 0};

    const containerRect = gameContainer.getBoundingClientRect();

    // Try to get the tile position directly from the Phaser game
    const phaserGame = (window as any).phaserGame;
    if (phaserGame?.scene?.scenes?.[0]?.getTileScreenPosition) {
      const gameScene = phaserGame.scene.scenes[0];
      const tilePos = gameScene.getTileScreenPosition(selectedTile);

      if (tilePos) {
        // Add the container's position to get the final screen position
        const screenX = containerRect.left + tilePos.x;
        const screenY = containerRect.top + tilePos.y;

        return {x: screenX, y: screenY};
      }
    }

    // If we can't get the position from the scene, use a simpler approach
    // that doesn't rely on the container's center
    const worldPixel = cubeToPixel(selectedTile, DEFAULT_HEX_SIZE);

    let cameraX = 0;
    let cameraY = 0;
    let zoom = 1;

    if (phaserGame?.scene?.scenes?.[0]?.cameras?.main) {
      const camera = phaserGame.scene.scenes[0].cameras.main;
      cameraX = camera.scrollX || 0;
      cameraY = camera.scrollY || 0;
      zoom = camera.zoom || 1;
    }

    // Calculate screen position without assuming the canvas is centered
    const canvas = gameContainer.querySelector('canvas');
    const canvasRect = canvas ? canvas.getBoundingClientRect() : containerRect;

    const screenX = canvasRect.left + ((worldPixel.x - cameraX) * zoom);
    const screenY = canvasRect.top + ((worldPixel.y - cameraY) * zoom);

    return {x: screenX, y: screenY};
  };

  const screenPosition = getScreenPosition();
  const menuRadius = 80;

  const getActionPosition = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    const x = screenPosition.x + Math.cos(radian) * menuRadius;
    const y = screenPosition.y + Math.sin(radian) * menuRadius;
    return {x, y};
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[45]">
      {/* Center indicator */}
      <div
        className="absolute w-6 h-6 bg-yellow-400 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
        style={{
          left: screenPosition.x,
          top: screenPosition.y,
        }}
      />

      {/* Action buttons */}
      {actions.map((action) => {
        const position = getActionPosition(action.angle);
        const Icon = action.icon;

        return (
          <div
            key={action.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto animate-fade-in"
            style={{
              left: position.x,
              top: position.y,
              animationDelay: `${actions.indexOf(action) * 50}ms`
            }}
          >
            <button
              onMouseDown={action.onClick}
              disabled={!action.enabled}
              className={`
                w-14 h-14 rounded-full shadow-xl border-2 border-white transition-all duration-200
                flex items-center justify-center text-white font-bold
                ${action.enabled
                ? `${action.color} hover:scale-110 active:scale-95`
                : 'bg-gray-500 opacity-50 cursor-not-allowed'
              }
              `}
              title={action.label}
            >
              <Icon className="w-6 h-6"/>
            </button>

            {/* Tooltip */}
            <div
              className="absolute bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap z-[50] opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                bottom: '120%',
                left: '50%',
                transform: 'translateX(-50%)'
              }}>
              {action.label}
            </div>
          </div>
        );
      })}

      {/* Connection lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{width: '100%', height: '100%'}}
      >
        {actions.map((action) => {
          if (!action.enabled) return null;

          const position = getActionPosition(action.angle);

          return (
            <line
              key={`line-${action.id}`}
              x1={screenPosition.x}
              y1={screenPosition.y}
              x2={position.x}
              y2={position.y}
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="2"
              strokeDasharray="2,2"
              className="animate-fade-in"
            />
          );
        })}
      </svg>
    </div>
  );
};
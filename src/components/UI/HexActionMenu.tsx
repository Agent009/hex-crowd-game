import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { movePlayer, selectTile } from '../../store/gameSlice';
import { cubeToPixel, DEFAULT_HEX_SIZE, coordsToKey } from '../../utils/hexGrid';
import { terrainData } from '../../data/gameData';
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
    currentPhase
  } = useSelector((state: RootState) => state.game);

  if (!selectedTile) return null;

  const tileKey = coordsToKey(selectedTile);
  const tile = tiles[tileKey];
  const currentPlayerStats = currentPlayer ? playerStats[currentPlayer.id] : null;
  const isPlayerOnTile = tile?.players?.some(p => p.id === currentPlayer?.id);
  const isActive = activeTiles.includes(tileKey);
  const terrain = terrainData[tile?.terrain || 'plains'];

  // Calculate screen position for the menu
  const pixel = cubeToPixel(selectedTile, DEFAULT_HEX_SIZE);
  const menuRadius = 60;

  const canMove = () => {
    if (!currentPlayer || !currentPlayerStats || currentPhase !== 'interaction') return false;
    if (isPlayerOnTile) return false;

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
      dispatch(selectTile(selectedTile)); // Keep tile selected after move
    }
  };

  const actions = [
    {
      id: 'move',
      icon: Move,
      label: 'Move Here',
      color: 'bg-blue-600 hover:bg-blue-700',
      enabled: canMove(),
      onClick: handleMove,
      angle: 0
    },
    {
      id: 'harvest-resource',
      icon: Package,
      label: 'Harvest Resource',
      color: 'bg-green-600 hover:bg-green-700',
      enabled: canHarvest() && currentPlayerStats!.actionPoints >= 1,
      onClick: () => onOpenHarvestGrid('resources'),
      angle: 60
    },
    {
      id: 'harvest-item',
      icon: Sparkles,
      label: 'Harvest Item',
      color: 'bg-purple-600 hover:bg-purple-700',
      enabled: canHarvest() && currentPlayerStats!.actionPoints >= 3,
      onClick: () => onOpenHarvestGrid('items'),
      angle: 120
    },
    {
      id: 'craft',
      icon: Hammer,
      label: 'Craft Item',
      color: 'bg-orange-600 hover:bg-orange-700',
      enabled: canCraft(),
      onClick: () => onOpenHarvestGrid('crafting'),
      angle: 180
    },
    {
      id: 'info',
      icon: Info,
      label: 'Tile Info',
      color: 'bg-slate-600 hover:bg-slate-700',
      enabled: true,
      onClick: onOpenTileInfo,
      angle: 240
    }
  ];

  const getActionPosition = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    const x = pixel.x + Math.cos(radian) * menuRadius;
    const y = pixel.y + Math.sin(radian) * menuRadius;
    return { x, y };
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Center indicator */}
      <div
        className="absolute w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        style={{
          left: pixel.x,
          top: pixel.y,
        }}
      />

      {/* Action buttons */}
      {actions.map((action) => {
        const position = getActionPosition(action.angle);
        const Icon = action.icon;

        return (
          <div
            key={action.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            <button
              onClick={action.onClick}
              disabled={!action.enabled}
              className={`
                w-12 h-12 rounded-full shadow-lg border-2 border-white transition-all duration-200
                flex items-center justify-center text-white font-bold
                ${action.enabled 
                  ? `${action.color} hover:scale-110 active:scale-95` 
                  : 'bg-gray-500 opacity-50 cursor-not-allowed'
                }
              `}
              title={action.label}
              onMouseEnter={(e) => {
                // Show tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'absolute bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap z-60';
                tooltip.textContent = action.label;
                tooltip.style.bottom = '120%';
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translateX(-50%)';
                e.currentTarget.appendChild(tooltip);
              }}
              onMouseLeave={(e) => {
                // Remove tooltip
                const tooltip = e.currentTarget.querySelector('.absolute');
                if (tooltip) {
                  tooltip.remove();
                }
              }}
            >
              <Icon className="w-5 h-5" />
            </button>
          </div>
        );
      })}

      {/* Connection lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      >
        {actions.map((action) => {
          if (!action.enabled) return null;

          const position = getActionPosition(action.angle);
          return (
            <line
              key={`line-${action.id}`}
              x1={pixel.x}
              y1={pixel.y}
              x2={position.x}
              y2={position.y}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}
      </svg>
    </div>
  );
};
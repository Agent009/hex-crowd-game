import React, { useEffect, useRef, useState } from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import { movePlayer, initiateCombat } from '../../store/gameSlice';
import { deselectTile } from '../../store/worldSlice';
import { toggleTileInfo } from '../../store/uiSlice';
import {cubeToPixel, DEFAULT_HEX_SIZE, coordsToKey, areAdjacent} from '../../utils/hexGrid';
import {terrainData} from '../../data/gameData';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { COMBAT_AP_COST } from '../../game/combat';
import {
  Package,
  Hammer,
  Info,
  Move,
  Sparkles,
  Swords
} from 'lucide-react';
import {GameScene} from "../../game/GameEngine";
import {getPhaserGame} from "../../game/phaserRef";

interface HexActionMenuProps {
  onOpenHarvestGrid: (tab: 'resources' | 'items' | 'crafting' | 'trade') => void;
}

export const HexActionMenu: React.FC<HexActionMenuProps> = ({
                                                              onOpenHarvestGrid
                                                            }) => {
  const dispatch = useDispatch();
  const { isMultiplayer, sendMove, sendInitiateCombat } = useMultiplayer();
  const { selectedTile, tiles, activeTiles } = useSelector((state: RootState) => state.world);
  const {
    currentPlayer,
    playerStats,
    currentPhase,
    showPhaseOverlay
  } = useSelector((state: RootState) => state.game);

  // Hide menu only when the blocking round_start modal is shown. Every other
  // phase renders a non-blocking bottom dock, so the action menu must stay
  // available (individual actions are still gated by phase internally).
  const blockingOverlay = showPhaseOverlay && currentPhase === 'round_start';
  const menuOpen = !!selectedTile && !blockingOverlay;

  // Keyboard focus within the radial menu. `null` = no item focused yet, so
  // Enter falls back to the primary (Move) action.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Snapshot of the rendered actions so the key handler can run them without
  // re-binding the listener on every render. Each entry's `run` performs the
  // action and closes/keeps the menu as appropriate.
  const actionsRef = useRef<Array<{ id: string; enabled: boolean; run: () => void }>>([]);

  // Reset focus whenever the selected tile changes (new menu instance).
  useEffect(() => {
    setFocusedId(null);
  }, [selectedTile]);

  // Tab / Shift+Tab to cycle items, Enter to confirm, Backspace to cancel.
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      const enabled = actionsRef.current.filter((a) => a.enabled);

      if (e.key === 'Tab') {
        e.preventDefault();
        if (enabled.length === 0) return;
        const currentIndex = enabled.findIndex((a) => a.id === focusedId);
        const delta = e.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + delta + enabled.length) % enabled.length;
        setFocusedId(enabled[nextIndex].id);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const focused = focusedId ? enabled.find((a) => a.id === focusedId) : null;
        // No explicit focus → confirm the primary Move action (fallback: first enabled).
        const toRun = focused ?? enabled.find((a) => a.id === 'move') ?? enabled[0];
        toRun?.run();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        dispatch(deselectTile());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, focusedId, dispatch]);

  if (!menuOpen) return null;

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

  // An enemy (different team) standing on the selected adjacent tile, if any.
  const enemyTarget = (() => {
    if (!currentPlayer || !tile?.players) return null;
    return tile.players.find(p => p.teamId !== currentPlayer.teamId) ?? null;
  })();

  const canAttack = () => {
    if (!currentPlayer || !currentPlayerStats || currentPhase !== 'interaction') return false;
    if (!enemyTarget) return false;
    if (!areAdjacent(currentPlayer.position, selectedTile)) return false;
    return currentPlayerStats.actionPoints >= COMBAT_AP_COST;
  };

  const handleAttack = () => {
    if (currentPlayer && enemyTarget && canAttack()) {
      if (isMultiplayer) {
        sendInitiateCombat(currentPlayer.id, enemyTarget.id);
      } else {
        dispatch(initiateCombat({
          attackerId: currentPlayer.id,
          defenderId: enemyTarget.id,
          tiles
        }));
      }
      dispatch(deselectTile());
    }
  };

  const handleMove = () => {
    if (currentPlayer && canMove()) {
      if (isMultiplayer) {
        sendMove(currentPlayer.id, selectedTile);
      } else {
        dispatch(movePlayer({
          playerId: currentPlayer.id,
          target: selectedTile,
          tiles
        }));
      }
      dispatch(deselectTile());
    }
  };

  // Run an action's effect, then close the menu unless it keeps it active
  // (panels that open over the board leave the selection in place).
  const activate = (action: { enabled: boolean; perform: () => void; keepMenuActive?: boolean }) => {
    if (!action.enabled) return;
    action.perform();
    if (!action.keepMenuActive) {
      dispatch(deselectTile());
    }
  };

  const enableHarvestResource = canHarvest() && (currentPlayerStats?.actionPoints ?? 0) >= 1;
  const enableHarvestItem = canHarvest() && (currentPlayerStats?.actionPoints ?? 0) >= 3;

  const actions = [
    {
      id: 'move',
      icon: Move,
      label: canMove() ? 'Move Here' : 'Cannot Move Here',
      color: 'bg-blue-600 hover:bg-blue-700',
      enabled: canMove(),
      perform: handleMove,
      angle: -90 // Top
    },
    {
      id: 'harvest-resource',
      icon: Package,
      label: enableHarvestResource ? 'Harvest Resource (1 AP)' : 'Harvest Resource (need 1 AP)',
      color: 'bg-green-600 hover:bg-green-700',
      enabled: enableHarvestResource,
      perform: () => onOpenHarvestGrid('resources'),
      keepMenuActive: true,
      angle: -30 // Top right
    },
    {
      id: 'harvest-item',
      icon: Sparkles,
      label: enableHarvestItem ? 'Harvest Item (3 AP)' : 'Harvest Item (need 3 AP)',
      color: 'bg-purple-600 hover:bg-purple-700',
      enabled: enableHarvestItem,
      perform: () => onOpenHarvestGrid('items'),
      keepMenuActive: true,
      angle: 30 // Bottom right
    },
    {
      id: 'craft',
      icon: Hammer,
      label: canCraft() ? 'Craft Item' : 'Cannot Craft Item',
      color: 'bg-orange-600 hover:bg-orange-700',
      enabled: canCraft(),
      perform: () => onOpenHarvestGrid('crafting'),
      keepMenuActive: true,
      angle: 90 // Bottom
    },
    {
      id: 'attack',
      icon: Swords,
      label: enemyTarget
        ? (canAttack()
            ? `Attack ${enemyTarget.name} (${COMBAT_AP_COST} AP)`
            : `Attack ${enemyTarget.name} (need ${COMBAT_AP_COST} AP)`)
        : 'No enemy here',
      color: 'bg-red-600 hover:bg-red-700',
      enabled: canAttack(),
      perform: handleAttack,
      angle: 150, // Bottom left
      hidden: !enemyTarget,
    },
    {
      id: 'info',
      icon: Info,
      label: 'Tile Info',
      color: 'bg-slate-600 hover:bg-slate-700',
      enabled: true,
      perform: () => dispatch(toggleTileInfo()),
      keepMenuActive: true,
      angle: 210 // Upper left
    }
  ].filter((a) => !('hidden' in a && a.hidden));

  // Expose the current actions to the keyboard handler.
  actionsRef.current = actions.map((a) => ({
    id: a.id,
    enabled: a.enabled,
    run: () => activate(a),
  }));

  // Calculate screen position more reliably
  const getScreenPosition = () => {
    // Get the game container
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return {x: 0, y: 0};

    const containerRect = gameContainer.getBoundingClientRect();

    const phaserGame = getPhaserGame();
    const gameScene = phaserGame?.scene?.getScene('GameScene') as GameScene | undefined;

    if (gameScene?.getTileScreenPosition) {
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
        const isFocused = focusedId === action.id && action.enabled;

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
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                activate(action);
              }}
              disabled={!action.enabled}
              aria-label={action.label}
              className={`
                w-14 h-14 rounded-full shadow-xl border-2 transition-all duration-200
                flex items-center justify-center text-white font-bold
                ${isFocused ? 'border-yellow-300 ring-4 ring-yellow-300/70 scale-110' : 'border-white'}
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

import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { harvestFromTile, craftItem } from '../../store/gameSlice';
import {
  resourceDatabase,
  itemDatabase,
  canCraftItem,
} from '../../data/harvestData';
import { isCraftable } from '../../utils/utils';
import { terrainData, TerrainType } from '../../data/gameData';
import { coordsToKey } from '../../utils/hexGrid';
import { resourceIcon, itemIcon } from '../../data/itemIcons';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { Zap, X, Pickaxe, Hammer, Lock, AlertCircle } from 'lucide-react';

export type TileActionMode = 'gather' | 'craft';

interface TileActionCardProps {
  initialMode: TileActionMode;
  onClose: () => void;
}

const RESOURCE_VALUE: Record<string, number> = Object.fromEntries(
  resourceDatabase.map(r => [r.id, r.value])
);

/**
 * Compact, board-anchored card for the core in-game loop (gather + craft).
 * Replaces the full-height harvest side panel: it shows only what's relevant to
 * the currently selected tile and the player's resources, so the board stays
 * visible. Harvesting/crafting are one click each with inline feedback.
 */
export const TileActionCard: React.FC<TileActionCardProps> = ({ initialMode, onClose }) => {
  const dispatch = useDispatch();
  const { isMultiplayer, sendHarvest, sendCraft } = useMultiplayer();
  const { currentPlayer, playerStats, currentPhase, globalItemQuantities } = useSelector(
    (state: RootState) => state.game
  );
  const { selectedTile, tiles, activeTiles } = useSelector((state: RootState) => state.world);

  const [mode, setMode] = useState<TileActionMode>(initialMode);
  const [flash, setFlash] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when the card is (re)opened from a different radial action.
  useEffect(() => setMode(initialMode), [initialMode]);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const showFlash = (text: string, kind: 'ok' | 'err') => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ text, kind });
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  };

  const stats = currentPlayer ? playerStats[currentPlayer.id] : null;
  const ap = stats?.actionPoints ?? 0;
  const tileKey = selectedTile ? coordsToKey(selectedTile) : null;
  const tile = tileKey ? tiles[tileKey] : null;
  const terrain: TerrainType | null = tile?.terrain ?? null;
  const onTile = !!tile?.players?.some(p => p.id === currentPlayer?.id);
  const tileActive = tileKey ? activeTiles.includes(tileKey) : false;
  const isInteraction = currentPhase === 'interaction';
  const canGatherHere = onTile && tileActive && isInteraction;

  const gatherBlockReason = (): string | null => {
    if (!isInteraction) return 'Only during the Interaction phase';
    if (!tile) return 'Select a tile to gather from';
    if (!onTile) return 'Stand on this tile to gather';
    if (!tileActive) return 'This tile is inactive';
    return null;
  };

  const doHarvestResource = (resourceId: string) => {
    if (!currentPlayer || !selectedTile) return;
    if (!canGatherHere) { showFlash(gatherBlockReason() ?? 'Cannot gather', 'err'); return; }
    if (ap < 1) { showFlash('Not enough AP', 'err'); return; }
    const payload = { playerId: currentPlayer.id, tileCoords: selectedTile, resourceId, isItem: false, tiles, activeTiles };
    if (isMultiplayer) sendHarvest(payload); else dispatch(harvestFromTile(payload));
    showFlash(`+1 ${resourceId}`, 'ok');
  };

  const doHarvestItem = (itemId: string, name: string) => {
    if (!currentPlayer || !selectedTile) return;
    if (!canGatherHere) { showFlash(gatherBlockReason() ?? 'Cannot gather', 'err'); return; }
    if (ap < 3) { showFlash('Items cost 3 AP', 'err'); return; }
    if ((globalItemQuantities?.[itemId] ?? 0) <= 0) { showFlash(`${name} depleted`, 'err'); return; }
    const payload = { playerId: currentPlayer.id, tileCoords: selectedTile, itemId, isItem: true, tiles, activeTiles };
    if (isMultiplayer) sendHarvest(payload); else dispatch(harvestFromTile(payload));
    showFlash(`Harvested ${name}`, 'ok');
  };

  const doCraft = (itemId: string, name: string) => {
    if (!currentPlayer || !stats) return;
    if (!isInteraction) { showFlash('Only during the Interaction phase', 'err'); return; }
    if ((globalItemQuantities?.[itemId] ?? 0) <= 0) { showFlash(`${name} depleted`, 'err'); return; }
    if (!canCraftItem(itemId, stats.resources)) { showFlash('Not enough resources', 'err'); return; }
    if (isMultiplayer) sendCraft(currentPlayer.id, itemId); else dispatch(craftItem({ playerId: currentPlayer.id, itemId }));
    showFlash(`Crafted ${name}`, 'ok');
  };

  const gatherResources = terrain
    ? resourceDatabase.filter(r => r.terrainDistribution[terrain] > 0)
    : [];
  const gatherItems = itemDatabase.slice(0, 3);
  const craftables = itemDatabase.filter(isCraftable);

  const title = mode === 'gather'
    ? (terrain ? `Gather — ${terrainData[terrain].name}` : 'Gather')
    : 'Craft';

  return (
    <div className="fixed bottom-4 right-4 w-72 max-h-[58vh] z-[55] flex flex-col rounded-xl bg-slate-800/95 backdrop-blur border border-slate-600 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700">
        <div className="flex items-center space-x-2 min-w-0">
          {mode === 'gather' ? <Pickaxe className="w-4 h-4 text-green-400 flex-shrink-0" /> : <Hammer className="w-4 h-4 text-orange-400 flex-shrink-0" />}
          <span className="text-white text-sm font-semibold truncate">{title}</span>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <span className="flex items-center space-x-1 bg-slate-700 rounded px-2 py-0.5">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-white text-xs font-bold">{ap}</span>
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex p-1 gap-1 bg-slate-900/40">
        {(['gather', 'craft'] as TileActionMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
              mode === m ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'gather' ? 'Gather' : 'Craft'}
          </button>
        ))}
      </div>

      {/* Flash */}
      {flash && (
        <div className={`mx-2 mt-2 px-2 py-1 rounded text-xs flex items-center ${
          flash.kind === 'ok' ? 'bg-green-900/70 text-green-200' : 'bg-red-900/70 text-red-200'
        }`}>
          <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
          {flash.text}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {mode === 'gather' && (
          <>
            {gatherBlockReason() && (
              <div className="text-amber-300/90 text-xs bg-amber-900/30 border border-amber-800/60 rounded px-2 py-1.5">
                {gatherBlockReason()}
              </div>
            )}
            {gatherResources.length === 0 && !gatherBlockReason() && (
              <div className="text-slate-500 text-xs text-center py-3 italic">No resources on this terrain</div>
            )}
            {gatherResources.map(r => {
              const enabled = canGatherHere && ap >= 1;
              return (
                <button
                  key={r.id}
                  onClick={() => doHarvestResource(r.id)}
                  disabled={!enabled}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors ${
                    enabled ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer' : 'bg-slate-800/60 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span className="text-lg leading-none">{resourceIcon(r.id)}</span>
                    <span className="text-left">
                      <span className="block text-white text-xs font-semibold">{r.name}</span>
                      <span className="block text-slate-400 text-[10px]">{r.value} coins</span>
                    </span>
                  </span>
                  <span className="flex items-center space-x-1 text-yellow-400">
                    <Zap className="w-3 h-3" />
                    <span className="text-xs font-bold">1</span>
                  </span>
                </button>
              );
            })}

            {gatherItems.length > 0 && (
              <div className="text-slate-500 text-[10px] uppercase tracking-wide pt-1 px-1">Items (3 AP)</div>
            )}
            {gatherItems.map(item => {
              const remaining = globalItemQuantities?.[item.id] ?? 0;
              const enabled = canGatherHere && ap >= 3 && remaining > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => doHarvestItem(item.id, item.name)}
                  disabled={!enabled}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors ${
                    enabled ? 'bg-blue-900/60 hover:bg-blue-800/70 cursor-pointer' : 'bg-slate-800/60 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span className="text-lg leading-none">{itemIcon(item.id)}</span>
                    <span className="text-left">
                      <span className="block text-white text-xs font-semibold flex items-center">
                        {item.name}
                        {remaining <= 0 && <Lock className="w-3 h-3 ml-1 text-slate-500" />}
                      </span>
                      <span className="block text-slate-400 text-[10px]">{remaining} left</span>
                    </span>
                  </span>
                  <span className="flex items-center space-x-1 text-yellow-400">
                    <Zap className="w-3 h-3" />
                    <span className="text-xs font-bold">3</span>
                  </span>
                </button>
              );
            })}
          </>
        )}

        {mode === 'craft' && (
          <>
            {!isInteraction && (
              <div className="text-amber-300/90 text-xs bg-amber-900/30 border border-amber-800/60 rounded px-2 py-1.5">
                Only during the Interaction phase
              </div>
            )}
            {craftables.map(item => {
              const remaining = globalItemQuantities?.[item.id] ?? 0;
              const affordable = !!stats && canCraftItem(item.id, stats.resources);
              const enabled = isInteraction && affordable && remaining > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => doCraft(item.id, item.name)}
                  disabled={!enabled}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors ${
                    enabled ? 'bg-orange-900/50 hover:bg-orange-800/60 cursor-pointer border border-orange-700/60' : 'bg-slate-800/60 opacity-60 cursor-not-allowed border border-transparent'
                  }`}
                >
                  <span className="flex items-center space-x-2 min-w-0">
                    <span className="text-lg leading-none">{itemIcon(item.id)}</span>
                    <span className="text-left min-w-0">
                      <span className="block text-white text-xs font-semibold truncate">{item.name}</span>
                      <span className="flex items-center flex-wrap gap-1 mt-0.5">
                        {Object.entries(item.craftingRequirements).map(([rid, cost]) => {
                          const has = (stats?.resources[rid] || 0) >= cost;
                          return (
                            <span key={rid} className={`text-[10px] px-1 rounded ${has ? 'text-green-300' : 'text-red-300'}`}>
                              {resourceIcon(rid)}{cost}
                            </span>
                          );
                        })}
                      </span>
                    </span>
                  </span>
                  <span className="text-slate-400 text-[10px] flex-shrink-0">{remaining} left</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Resource strip */}
      <div className="border-t border-slate-700 bg-slate-900/70 px-2 py-1.5 flex items-center justify-between">
        {resourceDatabase.map(r => (
          <span key={r.id} className="flex items-center space-x-0.5" title={`${r.name} (${RESOURCE_VALUE[r.id]} coins)`}>
            <span className="text-sm leading-none">{resourceIcon(r.id)}</span>
            <span className="text-slate-200 text-[11px] font-semibold">{stats?.resources[r.id] || 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

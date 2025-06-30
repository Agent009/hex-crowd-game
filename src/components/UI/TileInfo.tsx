import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { movePlayer, harvestFromTile } from '../../store/gameSlice';
import {coordsToKey, cubeToPixel, DEFAULT_HEX_SIZE, areAdjacent} from '../../utils/hexGrid';
import { terrainData, resourceData } from '../../data/gameData';
import { MapPin, Eye, Building, Users, Package, Zap, AlertCircle, X } from 'lucide-react';

export const TileInfo: React.FC = () => {
  const dispatch = useDispatch();
  const { selectedTile, tiles, players, currentPlayer, playerStats, activeTiles, currentPhase, showTileInfo } = useSelector((state: RootState) => state.game);

  if (!selectedTile || !showTileInfo) {
    return (
      null
    );
  }

  const key = coordsToKey(selectedTile);
  const tile = tiles[key];

  if (!tile) {
    return (
      <div className="absolute top-20 left-4 bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600 z-30">
        <p className="text-slate-400 text-sm">Invalid tile selected</p>
      </div>
    );
  }

  const { x, y } = cubeToPixel(tile.coords, DEFAULT_HEX_SIZE);
  const terrain = terrainData[tile.terrain];
  const resource = tile.resource ? resourceData[tile.resource] : null;
  const ResourceIcon = resource?.icon ?? null;
  const isPartiallyVisible = false; // No fog of war in party game
  const isActive = activeTiles.includes(key);
  const currentPlayerStats = currentPlayer ? playerStats[currentPlayer.id] : null;

  // Check if the current player is already on this tile
  const isPlayerOnTile = () => {
    if (!currentPlayer || !selectedTile) return false;
    return tile && tile.players?.some(p => p.id === currentPlayer.id);
  };

  // Check if player can move to this tile (simplified for party game)
  const canMoveToTile = () => {
    if (!currentPlayer) return false;

    // Only allow movement during interaction phase
    if (currentPhase !== 'interaction') return false;

    // Check if tile is adjacent to current position
    if (!areAdjacent(currentPlayer.position, selectedTile)) return false;

    // Check if player has enough AP for movement
    if (!currentPlayerStats) return false;

    let movementCost = terrain.moveCost || 1;

    // Check if terrain requires a specific item
    if (terrain.requiredItem) {
      const hasRequiredItem = currentPlayerStats.items.some(item => item.id === terrain.requiredItem);
      if (!hasRequiredItem) {
        // Player doesn't have required item - pay extra AP
        movementCost = terrain.alternativeAPCost || (terrain.moveCost + 1);
      }
    }

    return currentPlayerStats.actionPoints >= movementCost;
  };

  const handleMoveHere = () => {
    if (!currentPlayer) {
      console.log('No current player for movement');
      return;
    }

    console.log('Moving player from', currentPlayer.position, 'to', selectedTile);
    dispatch(movePlayer({
      playerId: currentPlayer.id,
      target: selectedTile
    }));
  };

  const handleHarvest = (isItem: boolean = false) => {
    if (!currentPlayer || !currentPlayerStats) {
      console.log('No current player for harvesting');
      return;
    }

    // Only allow harvesting during interaction phase
    if (currentPhase !== 'interaction') {
      alert('You can only harvest during the Interaction Phase!');
      return;
    }

    const apCost = isItem ? 3 : 1;
    if (currentPlayerStats.actionPoints < apCost) {
      alert(`Not enough Action Points! Need ${apCost} AP.`);
      return;
    }

    if (!isActive) {
      alert('This tile is inactive and cannot be harvested from.');
      return;
    }

    if (!isPlayerOnTile()) {
      alert('You must be on the tile to harvest from it.');
      return;
    }

    // Show message that player should use the harvest grid
    if (isItem) {
      alert('Use the Harvest Grid to select which item to harvest (3 AP)');
    } else {
      alert('Use the Harvest Grid to select which resource to harvest (1 AP)');
    }

    // The actual harvesting is now done through the HarvestGrid component
  };

  return (
    <div className={`absolute top-[8rem] left-4 bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600 min-w-64 z-30 ${
      isPartiallyVisible ? 'opacity-75' : ''
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center">
          <MapPin className="w-4 h-4 mr-2 text-blue-400" />
          Tile Information
        </h3>
      </div>

      <div className="flex items-center space-x-2 mb-3">
        <span className="text-slate-300 text-sm">
          Hex ({selectedTile.q}, {selectedTile.r}, {selectedTile.s}) ({Math.round(x)}, {Math.round(y)})
        </span>
      </div>

      <div className="space-y-2 text-sm">
        {/* Terrain */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Terrain:</span>
          <span
            className="font-semibold px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: terrain.color + '20',
              color: terrain.color
            }}
          >
            {terrain.name}
          </span>
        </div>

        {/* Movement Cost */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Move Cost:</span>
          <div className="flex flex-col items-end">
            <span className="text-white font-semibold">{terrain.moveCost || 1} AP</span>
            {terrain.requiredItem && (
              <span className="text-xs text-orange-400">
                +{(terrain.alternativeAPCost || terrain.moveCost + 1) - terrain.moveCost} AP without {terrain.requiredItem.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Required Item */}
        {terrain.requiredItem && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Requires:</span>
            <span className="text-orange-400 font-semibold capitalize">
              {terrain.requiredItem.replace('_', ' ')}
            </span>
          </div>
        )}

        {/* Terrain Effects */}
        {terrain.effects && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Effects:</span>
            <div className="text-right text-xs">
              {terrain.effects.hpLossPerRound && (
                <div className="text-red-400">
                  -{Math.abs(terrain.effects.hpLossPerRound)} HP/round
                  {terrain.effects.protectionItem && (
                    <div className="text-green-400">
                      (Protected by {terrain.effects.protectionItem.replace('_', ' ')})
                    </div>
                  )}
                  {terrain.effects.protectionResource && (
                    <div className="text-blue-400">
                      (Protected by {terrain.effects.protectionResource})
                    </div>
                  )}
                </div>
              )}
              {terrain.effects.itemChance && (
                <div className="text-purple-400">
                  {terrain.effects.itemChance}% item chance
                </div>
              )}
              {terrain.effects.alwaysActive && (
                <div className="text-green-400">
                  Always harvestable
                </div>
              )}
            </div>
          </div>
        )}

        {/* Defense Bonus */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Defense Bonus:</span>
          <span className={`font-semibold ${(terrain.defenseBonus || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(terrain.defenseBonus || 0) >= 0 ? '+' : ''}{terrain.defenseBonus || 0}
          </span>
        </div>

        {/* Disaster Vulnerability */}
        {terrain.disasters && terrain.disasters.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Disasters:</span>
            <span className="text-red-400 text-xs">
              {terrain.disasters.join(', ')}
            </span>
          </div>
        )}

        {/* Tile Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Status:</span>
          <span className={`font-semibold ${isActive ? 'text-green-400' : 'text-red-400'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Resource */}
        {resource && ResourceIcon && !tile.resourceDepleted && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Resource:</span>
            <div className="flex items-center space-x-1">
              <ResourceIcon className="w-3 h-3" style={{ color: resource.color }} />
              <span style={{ color: resource.color }} className="font-semibold">
                {resource.name}
              </span>
            </div>
          </div>
        )}

        {/* Depleted Resource */}
        {resource && ResourceIcon && tile.resourceDepleted && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Resource:</span>
            <div className="flex items-center space-x-1">
              <ResourceIcon className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500 font-semibold">
                {resource.name} (Depleted)
              </span>
            </div>
          </div>
        )}

        {/* Building */}
        {tile.building && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Building:</span>
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-semibold capitalize">
                {tile.building.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Players */}
        {tile.players && tile.players.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Occupant:</span>
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 font-semibold">
                {tile.players.length === 1 ? tile.players[0].name : `${tile.players.length} Players`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-slate-600">
        <div className="text-slate-400 text-xs">
          Click on the tile in the game world to see available actions
        </div>

        {!currentPlayer && (
          <div className="mt-2 text-xs text-yellow-400">
            No current player selected
          </div>
        )}

        {currentPlayer && currentPhase !== 'interaction' && (
          <div className="mt-2 text-xs text-orange-400">
            Actions only available during Interaction Phase
          </div>
        )}

        {currentPlayer && isPlayerOnTile() && (
          <div className="mt-2 space-y-1">
            {currentPlayerStats && (
              <div className="flex items-center space-x-2 text-xs">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-white">AP: {currentPlayerStats.actionPoints}</span>
              </div>
            )}
            {!isActive && (
              <div className="flex items-center space-x-1 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span>Tile is inactive - cannot harvest</span>
              </div>
            )}
            {isActive && tile.terrain === 'lake' && (
              <div className="text-xs text-blue-400">
                Lake tiles can be harvested multiple times
              </div>
            )}
          </div>
        )}

        {currentPlayerStats && (
          <div className="mt-2 p-2 bg-slate-700 rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300">Player Resources:</span>
              <div className="flex items-center space-x-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400 font-semibold">{currentPlayerStats.actionPoints} AP</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(currentPlayerStats.resources).map(([resourceId, count]) => (
                <div key={resourceId} className="flex justify-between">
                  <span className="text-slate-400 capitalize">{resourceId}:</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(currentPlayerStats.resources).length === 0 && (
                <div className="text-slate-500 col-span-2">No resources</div>
              )}
            </div>
            {currentPlayerStats.items.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-600">
                <div className="text-slate-300 mb-1">Items: {currentPlayerStats.items.length}</div>
                <div className="text-slate-400 text-xs">
                  {currentPlayerStats.items.map(item => item.name).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
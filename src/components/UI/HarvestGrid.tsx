import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { harvestFromTile, craftItem } from '../../store/gameSlice';
import {
  HarvestGrid as HarvestGridClass,
  ResourceData,
  ItemData,
  resourceDatabase,
  itemDatabase,
  calculateItemValue,
  canCraftItem
} from '../../data/harvestData';
import { terrainData, TerrainType } from '../../data/gameData';
import { coordsToKey } from '../../utils/hexGrid';
import {
  Package,
  Hammer,
  Clock,
  Coins,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wrench,
  Sparkles,
  Lock,
  AlertCircle
} from 'lucide-react';

export const HarvestGrid: React.FC = () => {
  const dispatch = useDispatch();
  const { currentPlayer, playerStats, selectedTile, tiles, activeTiles } = useSelector((state: RootState) => state.game);

  const [harvestGrid] = useState(() => new HarvestGridClass());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [showCrafting, setShowCrafting] = useState(false);

  // Refresh grid display
  const [gridKey, setGridKey] = useState(0);

  const currentPlayerStats = currentPlayer ? playerStats[currentPlayer.id] : null;
  const selectedTileKey = selectedTile ? coordsToKey(selectedTile) : null;
  const selectedTileData = selectedTileKey ? tiles[selectedTileKey] : null;
  const isPlayerOnSelectedTile = selectedTileData?.players?.some(p => p.id === currentPlayer?.id);
  const isSelectedTileActive = selectedTileKey ? activeTiles.includes(selectedTileKey) : false;

  const handleHarvestResource = (terrainType: TerrainType, slotIndex: number) => {
    if (!currentPlayer || !currentPlayerStats || !selectedTile) {
      alert('You must select a tile and be on it to harvest!');
      return;
    }

    if (!isPlayerOnSelectedTile) {
      alert('You must be on the selected tile to harvest from it!');
      return;
    }

    if (!isSelectedTileActive) {
      alert('This tile is inactive and cannot be harvested from!');
      return;
    }

    if (selectedTileData?.terrain !== terrainType) {
      alert(`You can only harvest ${terrainType} resources from ${terrainType} tiles!`);
      return;
    }

    if (currentPlayerStats.actionPoints < 1) {
      alert('Not enough Action Points!');
      return;
    }

    const resource = harvestGrid.harvestResource(terrainType, slotIndex);
    if (resource) {
      // Dispatch harvest action to Redux
      dispatch(harvestFromTile({
        playerId: currentPlayer.id,
        tileCoords: selectedTile,
        resourceId: resource.id,
        isItem: false
      }));

      setGridKey(prev => prev + 1); // Force re-render
    }
  };

  const handleHarvestItem = (slotIndex: number) => {
    if (!currentPlayer || !currentPlayerStats || !selectedTile) {
      alert('You must select a tile and be on it to harvest!');
      return;
    }

    if (!isPlayerOnSelectedTile) {
      alert('You must be on the selected tile to harvest from it!');
      return;
    }

    if (!isSelectedTileActive) {
      alert('This tile is inactive and cannot be harvested from!');
      return;
    }

    if (currentPlayerStats.actionPoints < 3) {
      alert('Not enough Action Points! Items cost 3 AP.');
      return;
    }

    const item = harvestGrid.harvestItem(slotIndex);
    if (item) {
      // Dispatch harvest action to Redux
      dispatch(harvestFromTile({
        playerId: currentPlayer.id,
        tileCoords: selectedTile,
        itemId: item.id,
        isItem: true
      }));

      setGridKey(prev => prev + 1); // Force re-render
    }
  };

  const handleCraftItem = (itemId: string) => {
    if (!currentPlayerStats) {
      alert('No player selected!');
      return;
    }

    if (!canCraftItem(itemId, currentPlayerStats.resources)) {
      alert('Cannot craft item - insufficient resources!');
      return;
    }

    if (!currentPlayer) {
      alert('No current player!');
      return;
    }

    // Dispatch crafting action to Redux
    dispatch(craftItem({
      playerId: currentPlayer.id,
      itemId
    }));

    const itemTemplate = itemDatabase.find(item => item.id === itemId);
    if (itemTemplate) {
      alert(`Successfully crafted ${itemTemplate.name}!`);
    }
  };

  const renderResourceIcon = (resourceId: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      cloth: '🧵',
      wood: '🪵',
      stone: '🪨',
      water: '💧',
      shard: '💎',
      gems: '💎'
    };
    return icons[resourceId] || '📦';
  };

  const renderItemIcon = (itemId: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      boat: '⛵',
      camping_gear: '🏕️',
      climbing_gear: '🧗',
      cloak: '🧥',
      survival_kit: '🎒',
      terraform: '🌍',
      leech: '🩸',
      armageddon: '💥',
      rejuvenate: '💚'
    };
    return icons[itemId] || '📦';
  };

  const terrainTypes: TerrainType[] = ['plains', 'desert', 'forest', 'mountain', 'river', 'lake'];

  return (
    <div className="fixed top-20 right-4 w-96 bg-slate-800 rounded-lg shadow-xl border border-slate-600 z-40 max-h-[calc(100vh-6rem)] overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-600">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-bold text-lg flex items-center">
            <Package className="w-5 h-5 mr-2 text-green-400" />
            Harvest Grid
          </h2>
          <button
            onClick={() => {
              harvestGrid.refillGrid();
              setGridKey(prev => prev + 1);
            }}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            title="Refresh Grid"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-semibold">
              {currentPlayerStats?.actionPoints || 0} AP
            </span>
          </div>
          <div className="text-slate-400">
            Resources: 1 AP • Items: 3 AP
          </div>
        </div>

        {/* Status Messages */}
        {!currentPlayer && (
          <div className="mt-2 p-2 bg-yellow-900 rounded text-yellow-200 text-xs flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            No player selected
          </div>
        )}

        {currentPlayer && !isPlayerOnSelectedTile && (
          <div className="mt-2 p-2 bg-red-900 rounded text-red-200 text-xs flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            You must be on the selected tile to harvest
          </div>
        )}

        {currentPlayer && isPlayerOnSelectedTile && !isSelectedTileActive && (
          <div className="mt-2 p-2 bg-red-900 rounded text-red-200 text-xs flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            This tile is inactive - cannot harvest
          </div>
        )}
      </div>

      {/* Player Resources */}
      {currentPlayerStats && (
        <div className="p-4 border-b border-slate-600">
          <h3 className="text-white font-semibold mb-2 flex items-center">
            <Coins className="w-4 h-4 mr-2 text-yellow-400" />
            Your Resources
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(currentPlayerStats.resources).map(([resourceId, count]) => {
              const resource = resourceDatabase.find(r => r.id === resourceId);
              return (
                <div key={resourceId} className="flex items-center space-x-1 bg-slate-700 p-2 rounded">
                  <span className="text-lg">{renderResourceIcon(resourceId)}</span>
                  <div>
                    <div className="text-white text-xs font-semibold">{count}</div>
                    <div className="text-slate-400 text-xs">{resource?.name || resourceId}</div>
                  </div>
                </div>
              );
            })}
            {Object.keys(currentPlayerStats.resources).length === 0 && (
              <div className="col-span-3 text-slate-500 text-center text-xs py-2">
                No resources collected yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Items */}
      {currentPlayerStats && currentPlayerStats.items.length > 0 && (
        <div className="p-4 border-b border-slate-600">
          <h3 className="text-white font-semibold mb-2 flex items-center">
            <Wrench className="w-4 h-4 mr-2 text-purple-400" />
            Your Items ({currentPlayerStats.items.length})
          </h3>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {currentPlayerStats.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between bg-slate-700 p-2 rounded text-xs">
                <div className="flex items-center space-x-2">
                  <span>{renderItemIcon(item.id)}</span>
                  <span className="text-white">{item.name}</span>
                </div>
                <div className="text-slate-400">
                  {item.minUses} uses • {calculateItemValue(item)} coins
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Harvest Grid */}
      <div className="p-4" key={gridKey}>
        <h3 className="text-white font-semibold mb-3">Available Resources</h3>

        <div className="space-y-3">
          {terrainTypes.map(terrainType => {
            const terrain = terrainData[terrainType];
            const TerrainIcon = terrain.icon;
            const visibleItems = harvestGrid.getVisibleItems(terrainType);
            const resources = visibleItems.filter(item => 'terrainDistribution' in item).slice(0, 3);
            const canHarvestFromTerrain = selectedTileData?.terrain === terrainType && isPlayerOnSelectedTile && isSelectedTileActive;

            return (
              <div key={terrainType} className={`rounded-lg p-3 ${canHarvestFromTerrain ? 'bg-slate-700' : 'bg-slate-800 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TerrainIcon className="w-4 h-4" style={{ color: terrain.color }} />
                    <span className="text-white font-medium text-sm">{terrain.name}</span>
                    {!canHarvestFromTerrain && (
                      <Lock className="w-3 h-3 text-slate-500" />
                    )}
                  </div>
                  <span className="text-slate-400 text-xs">
                    {resources.length}/3 resources
                  </span>
                </div>

                <div className="space-y-1">
                  {resources.map((resource, index) => {
                    const resourceData = resource as ResourceData;
                    const canHarvest = canHarvestFromTerrain && currentPlayerStats && currentPlayerStats.actionPoints >= 1;

                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded transition-colors ${
                          canHarvest 
                            ? 'bg-slate-600 hover:bg-slate-500 cursor-pointer' 
                            : 'bg-slate-700 opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => canHarvest && handleHarvestResource(terrainType, index)}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{renderResourceIcon(resourceData.id)}</span>
                          <div>
                            <div className="text-white text-xs font-semibold">{resourceData.name}</div>
                            <div className="text-slate-400 text-xs">{resourceData.value} coins</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400 text-xs font-semibold">1</span>
                        </div>
                      </div>
                    );
                  })}

                  {resources.length === 0 && (
                    <div className="text-slate-500 text-xs text-center py-2 italic">
                      No resources available
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items Section */}
      <div className="border-t border-slate-600">
        <button
          onClick={() => setShowItems(!showItems)}
          className="w-full p-4 flex items-center justify-between text-white hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-purple-400" />
            <span className="font-semibold">Items</span>
          </div>
          {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showItems && (
          <div className="p-4 pt-0 space-y-2 max-h-48 overflow-y-auto">
            <div className="text-slate-400 text-xs mb-3">
              Only the top 3 items are available for harvest. Items cost 3 AP each.
            </div>

            {itemDatabase.map((item, index) => {
              const isEnabled = index < 3; // Only top 3 items are enabled
              const canHarvest = isEnabled && isPlayerOnSelectedTile && isSelectedTileActive &&
                               currentPlayerStats && currentPlayerStats.actionPoints >= 3;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded border transition-colors ${
                    isEnabled 
                      ? canHarvest
                        ? 'bg-slate-600 border-purple-600 hover:bg-slate-500 cursor-pointer' 
                        : 'bg-slate-700 border-slate-600'
                      : 'bg-slate-800 border-slate-700 opacity-40'
                  }`}
                  onClick={() => canHarvest && handleHarvestItem(index)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{renderItemIcon(item.id)}</span>
                      <div>
                        <div className="text-white text-sm font-semibold flex items-center space-x-2">
                          <span>{item.name}</span>
                          {!isEnabled && <Lock className="w-3 h-3 text-slate-500" />}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {item.minUses}-{item.maxUses} uses
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-yellow-400 text-xs font-semibold">3</span>
                    </div>
                  </div>

                  {/* Effects */}
                  <div className="text-slate-400 text-xs">
                    {item.effects.slice(0, 1).join(' • ')}
                    {item.effects.length > 1 && '...'}
                  </div>

                  {!isEnabled && (
                    <div className="mt-2 text-red-400 text-xs flex items-center">
                      <Lock className="w-3 h-3 mr-1" />
                      Item slot disabled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crafting Section */}
      <div className="border-t border-slate-600">
        <button
          onClick={() => setShowCrafting(!showCrafting)}
          className="w-full p-4 flex items-center justify-between text-white hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Hammer className="w-4 h-4 text-orange-400" />
            <span className="font-semibold">Crafting</span>
          </div>
          {showCrafting ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showCrafting && currentPlayerStats && (
          <div className="p-4 pt-0 space-y-2 max-h-48 overflow-y-auto">
            {itemDatabase.map(item => {
              const canCraft = canCraftItem(item.id, currentPlayerStats.resources);

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded border transition-colors ${
                    canCraft 
                      ? 'bg-slate-600 border-green-600 hover:bg-slate-500 cursor-pointer' 
                      : 'bg-slate-700 border-slate-600 opacity-50'
                  }`}
                  onClick={() => canCraft && handleCraftItem(item.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{renderItemIcon(item.id)}</span>
                      <div>
                        <div className="text-white text-sm font-semibold">{item.name}</div>
                        <div className="text-slate-400 text-xs">
                          {item.minUses}-{item.maxUses} uses
                        </div>
                      </div>
                    </div>
                    {canCraft && (
                      <Sparkles className="w-4 h-4 text-green-400" />
                    )}
                  </div>

                  {/* Requirements */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(item.craftingRequirements).map(([resourceId, cost]) => {
                      const hasEnough = (currentPlayerStats.resources[resourceId] || 0) >= cost;
                      return (
                        <div 
                          key={resourceId}
                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                            hasEnough ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                          }`}
                        >
                          <span>{renderResourceIcon(resourceId)}</span>
                          <span>{cost}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Effects */}
                  <div className="text-slate-400 text-xs">
                    {item.effects.join(' • ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
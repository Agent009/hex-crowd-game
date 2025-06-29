import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
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
  Sparkles
} from 'lucide-react';

export const HarvestGrid: React.FC = () => {
  const dispatch = useDispatch();
  const { currentPlayer, gameMode } = useSelector((state: RootState) => state.game);
  
  const [harvestGrid] = useState(() => new HarvestGridClass());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showCrafting, setShowCrafting] = useState(false);
  const [playerResources, setPlayerResources] = useState<{ [key: string]: number }>({});
  const [playerItems, setPlayerItems] = useState<ItemData[]>([]);
  const [actionPoints, setActionPoints] = useState(10);

  // Refresh grid display
  const [gridKey, setGridKey] = useState(0);

  useEffect(() => {
    // Initialize player with starting resources for demo
    setPlayerResources({
      cloth: 5,
      wood: 3,
      stone: 2,
      water: 4,
      shard: 1,
      gems: 0
    });
  }, []);

  const handleHarvestResource = (terrainType: TerrainType, slotIndex: number) => {
    if (actionPoints < 1) {
      alert('Not enough Action Points!');
      return;
    }

    const resource = harvestGrid.harvestResource(terrainType, slotIndex);
    if (resource) {
      setPlayerResources(prev => ({
        ...prev,
        [resource.id]: (prev[resource.id] || 0) + 1
      }));
      setActionPoints(prev => prev - 1);
      setGridKey(prev => prev + 1); // Force re-render
    }
  };

  const handleHarvestItem = (slotIndex: number) => {
    if (actionPoints < 3) {
      alert('Not enough Action Points! Items cost 3 AP.');
      return;
    }

    const item = harvestGrid.harvestItem(slotIndex);
    if (item) {
      setPlayerItems(prev => [...prev, item]);
      setActionPoints(prev => prev - 3);
      setGridKey(prev => prev + 1); // Force re-render
    }
  };

  const handleCraftItem = (itemId: string) => {
    const item = harvestGrid.craftItem(itemId, playerResources);
    if (item) {
      // Deduct resources
      const itemTemplate = itemDatabase.find(i => i.id === itemId);
      if (itemTemplate) {
        const newResources = { ...playerResources };
        Object.entries(itemTemplate.craftingRequirements).forEach(([resourceId, cost]) => {
          newResources[resourceId] = (newResources[resourceId] || 0) - cost;
        });
        setPlayerResources(newResources);
        setPlayerItems(prev => [...prev, item]);
      }
    } else {
      alert('Cannot craft item - insufficient resources!');
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

  if (gameMode !== 'playing') {
    return null;
  }

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
            <span className="text-white font-semibold">{actionPoints} AP</span>
          </div>
          <div className="text-slate-400">
            Resources: 1 AP • Items: 3 AP
          </div>
        </div>
      </div>

      {/* Player Resources */}
      <div className="p-4 border-b border-slate-600">
        <h3 className="text-white font-semibold mb-2 flex items-center">
          <Coins className="w-4 h-4 mr-2 text-yellow-400" />
          Your Resources
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(playerResources).map(([resourceId, count]) => {
            const resource = resourceDatabase.find(r => r.id === resourceId);
            return (
              <div key={resourceId} className="flex items-center space-x-1 bg-slate-700 p-2 rounded">
                <span className="text-lg">{renderResourceIcon(resourceId)}</span>
                <div>
                  <div className="text-white text-xs font-semibold">{count}</div>
                  <div className="text-slate-400 text-xs">{resource?.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Items */}
      {playerItems.length > 0 && (
        <div className="p-4 border-b border-slate-600">
          <h3 className="text-white font-semibold mb-2 flex items-center">
            <Wrench className="w-4 h-4 mr-2 text-purple-400" />
            Your Items ({playerItems.length})
          </h3>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {playerItems.map((item, index) => (
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

      {/* Harvest Grid */}
      <div className="p-4" key={gridKey}>
        <h3 className="text-white font-semibold mb-3">Available Resources & Items</h3>
        
        <div className="space-y-3">
          {terrainTypes.map(terrainType => {
            const terrain = terrainData[terrainType];
            const TerrainIcon = terrain.icon;
            const visibleItems = harvestGrid.getVisibleItems(terrainType);
            
            return (
              <div key={terrainType} className="bg-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TerrainIcon className="w-4 h-4" style={{ color: terrain.color }} />
                    <span className="text-white font-medium text-sm">{terrain.name}</span>
                  </div>
                  <span className="text-slate-400 text-xs">
                    {visibleItems.length}/3 items
                  </span>
                </div>
                
                <div className="space-y-1">
                  {visibleItems.map((item, index) => {
                    const isResource = 'terrainDistribution' in item;
                    const resource = isResource ? item as ResourceData : null;
                    const itemData = !isResource ? item as ItemData : null;
                    
                    return (
                      <div 
                        key={index}
                        className="flex items-center justify-between bg-slate-600 p-2 rounded hover:bg-slate-500 transition-colors cursor-pointer"
                        onClick={() => {
                          if (isResource) {
                            handleHarvestResource(terrainType, index);
                          } else {
                            handleHarvestItem(index);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {isResource ? renderResourceIcon(resource!.id) : renderItemIcon(itemData!.id)}
                          </span>
                          <div>
                            <div className="text-white text-xs font-semibold">
                              {isResource ? resource!.name : itemData!.name}
                            </div>
                            <div className="text-slate-400 text-xs">
                              {isResource ? `${resource!.value} coins` : `${itemData!.minUses}-${itemData!.maxUses} uses`}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400 text-xs font-semibold">
                            {isResource ? '1' : '3'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {visibleItems.length === 0 && (
                    <div className="text-slate-500 text-xs text-center py-2 italic">
                      No items available
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
        
        {showCrafting && (
          <div className="p-4 pt-0 space-y-2 max-h-48 overflow-y-auto">
            {itemDatabase.map(item => {
              const canCraft = canCraftItem(item.id, playerResources);
              
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
                      const hasEnough = (playerResources[resourceId] || 0) >= cost;
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
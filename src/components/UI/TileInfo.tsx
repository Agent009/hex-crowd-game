import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { exploreTile, moveHero } from '../../store/gameSlice';
import {coordsToKey, cubeToPixel, DEFAULT_HEX_SIZE} from '../../utils/hexGrid';
import { terrainData, resourceData } from '../../data/gameData';
import { MapPin, Eye, Building, Users } from 'lucide-react';

export const TileInfo: React.FC = () => {
  const dispatch = useDispatch();
  const { cities, selectedTile, tiles, showFogOfWar, selectedHero, heroes, actionPoints } = useSelector((state: RootState) => state.game);
  
  if (!selectedTile) {
    return (
      <div className="absolute bottom-4 left-4 bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600">
        <p className="text-slate-400 text-sm">Select a tile to view information</p>
      </div>
    );
  }
  
  const key = coordsToKey(selectedTile);
  const tile = tiles[key];
  
  if (!tile || (showFogOfWar && tile.fogLevel === 0)) {
    return (
      <div className="absolute bottom-4 left-4 bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600">
        <p className="text-slate-400 text-sm">This area is shrouded in fog</p>
      </div>
    );
  }

  const { x, y } = cubeToPixel(tile.coords, DEFAULT_HEX_SIZE);
  const terrain = terrainData[tile.terrain];
  const resource = tile.resource ? resourceData[tile.resource] : null;
  const ResourceIcon = resource?.icon ?? null;
  const isPartiallyVisible = tile.fogLevel === 1;
  const selectedHeroData = heroes.find(h => h.id === selectedHero);
  // console.log("TileInfo > coords", tile.coords, x, y, "terrain", terrain, "resource", resource, "isPartiallyVisible", isPartiallyVisible);
  
  // Check if the selected hero is already on this tile
  const isHeroOnTile = () => {
    if (!selectedHero || !selectedTile) return false;
    return tile && tile.hero?.id === selectedHero;
  };
  
  // Check if player can afford movement to this tile
  const canAffordMovement = () => {
    if (!selectedHeroData) return false;
    const moveCost = terrain.moveCost * 100;
    const apCost = terrain.moveCost;
    return selectedHeroData.movement >= moveCost && actionPoints >= apCost;
  };

  const handleMoveHere = () => {
    if (!selectedHero || !selectedHeroData) {
      console.log('No hero selected for movement');
      return;
    }
    
    // Find current hero position
    const heroTile = Object.entries(tiles).find(([, tile]) => tile.hero?.id === selectedHero);
    if (heroTile) {
      const [, currentTile] = heroTile;
      
      // Calculate path and costs
      const path = [currentTile.coords, selectedTile];
      let apCost = 0;
      let moveCost = 0;
      
      // Calculate movement cost based on target terrain
      const targetKey = coordsToKey(selectedTile);
      const targetTile = tiles[targetKey];
      if (targetTile) {
        const terrainData = {
          grass: 1, forest: 2, mountain: 3, water: 999, desert: 2, swamp: 3
        };
        const terrainMoveCost = terrainData[targetTile.terrain as keyof typeof terrainData] || 1;
        apCost = terrainMoveCost;
        moveCost = terrainMoveCost * 100;
      }
      
      console.log('Moving hero from', currentTile.coords, 'to', selectedTile, 'AP cost:', apCost, 'Movement cost:', moveCost);
      dispatch(moveHero({ 
        heroId: selectedHero, 
        target: selectedTile, 
        path 
      }));
    } else {
      console.log('Could not find current hero position');
    }
  };
  
  const handleExplore = () => {
    dispatch(exploreTile(selectedTile));
  };
  
  return (
    <div className={`absolute bottom-4 left-4 bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600 min-w-64 z-20 ${
      isPartiallyVisible ? 'opacity-75' : ''
    }`}>
      <div className="flex items-center space-x-2 mb-3">
        <MapPin className="w-4 h-4 text-blue-400" />
        <h3 className="text-white font-semibold">
          Hex ({selectedTile.q}, {selectedTile.r}, {selectedTile.s}) ({Math.round(x)}, {Math.round(y)})
        </h3>
        {isPartiallyVisible && (
          <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded">
            Partially Visible
          </span>
        )}
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
          <span className="text-white font-semibold">{terrain.moveCost} AP</span>
        </div>
        
        {/* Defense Bonus */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Defense Bonus:</span>
          <span className={`font-semibold ${terrain.defenseBonus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {terrain.defenseBonus >= 0 ? '+' : ''}{terrain.defenseBonus}
          </span>
        </div>
        
        {/* Exploration Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Status:</span>
          <div className="flex items-center space-x-1">
            <Eye className={`w-3 h-3 ${
              tile.fogLevel === 2 ? 'text-green-400' : 
              tile.fogLevel === 1 ? 'text-yellow-400' : 
              'text-slate-500'
            }`} />
            <span className={tile.explored ? 'text-green-400' : 'text-slate-500'}>
              {tile.fogLevel === 2 ? 'Explored' : 
               tile.fogLevel === 1 ? 'Visible' : 
               'Unexplored'}
            </span>
          </div>
        </div>
        
        {/* Resource */}
        {resource && ResourceIcon && !isPartiallyVisible && !tile.resourceDepleted && (
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
        {resource && ResourceIcon && !isPartiallyVisible && tile.resourceDepleted && (
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
        {tile.building && !isPartiallyVisible && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Building:</span>
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-semibold capitalize">
                {tile.building.replace('_', ' ')}
                {(() => {
                  // Find if this building is under construction or upgrading
                  const city = cities[0]; // Get nearest city
                  const building = city?.buildings.find(b => b.type === tile.building);
                  if (building?.isUnderConstruction) return ' (Building...)';
                  if (building?.isUpgrading) return ' (Upgrading...)';
                  if (tile.building === 'town_hall') return ' (City Center)';
                  return '';
                })()}
              </span>
            </div>
          </div>
        )}
        
        {/* Units/Hero */}
        {(tile.unit || tile.hero) && !isPartiallyVisible && (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Occupant:</span>
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 font-semibold">
                {tile.hero ? `${tile.hero.name} (Hero)` : 'Units'}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      {tile.fogLevel > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-600">
          <div className={`grid gap-2 ${tile.fogLevel === 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button 
              onClick={handleMoveHere}
              className={`bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tile.fogLevel === 2 ? 'col-span-1' : ''
              }`}
              disabled={!selectedHero || isPartiallyVisible || !canAffordMovement() || isHeroOnTile()}
            >
              Move Here
            </button>
            {tile.fogLevel < 2 && (
              <button 
                onClick={handleExplore}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={actionPoints < 1}
              >
                Explore
              </button>
            )}
          </div>
          
          {!selectedHero ? (
            <div className="mt-2 text-xs text-yellow-400">
              Select a hero to move
            </div>
          ) : isHeroOnTile() ? (
            <div className="mt-2 text-xs text-slate-400">
              Hero is already on this tile
            </div>
          ) : !canAffordMovement() && selectedHero ? (
            <div className="mt-2 text-xs text-red-400">
              Not enough AP or movement points
            </div>
          ) : actionPoints < 1 && tile.fogLevel < 2 ? (
            <div className="mt-2 text-xs text-red-400">
              Not enough AP to explore
            </div>
          ) : null}
        </div>
      )}
      
      {/* Movement/AP Cost Info */}
      {tile.fogLevel > 0 && selectedHero && (
        <div className="mt-2 p-2 bg-slate-700 rounded text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Move Cost:</span>
            <span className="text-blue-400 font-semibold">{terrain.moveCost} AP</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Movement:</span>
            <span className="text-green-400 font-semibold">{terrain.moveCost * 100} MP</span>
          </div>
        </div>
      )}
      
      {isPartiallyVisible && (
        <div className="mt-3 p-2 bg-yellow-900 bg-opacity-50 rounded text-xs text-yellow-200">
          Move closer to reveal more details
        </div>
      )}
    </div>
  );
};

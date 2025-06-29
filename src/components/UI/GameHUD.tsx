import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { nextTurn, toggleGrid, toggleFogOfWar, updateBuildingSystem } from '../../store/gameSlice';
import {
  Play,
  Grid3X3,
  Eye,
  EyeOff,
  BookOpen,
  Users,
  Database
} from 'lucide-react';
import { resourceData } from '../../data/gameData';
import { BuildingGuide } from './BuildingGuide';

export const GameHUD: React.FC = () => {
  const dispatch = useDispatch();
  const {
    resources,
    resourceStorage,
    population,
    maxPopulation,
    currentTurn,
    actionPoints,
    maxActionPoints,
    showGrid,
    showFogOfWar,
    selectedHero,
    heroes,
    buildingEffects
  } = useSelector((state: RootState) => state.game);

  const [showBuildingGuide, setShowBuildingGuide] = React.useState(false);

  const selectedHeroData = heroes.find(h => h.id === selectedHero);

  React.useEffect(() => {
    // Update building system on component mount and when relevant state changes
    dispatch(updateBuildingSystem());
  }, [dispatch]);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-slate-800 to-slate-700 shadow-lg border-b border-slate-600">
      <div className="flex items-center justify-between p-4">
        {/* Resources */}
        <div className="flex items-center space-x-4">
          {Object.entries(resources).map(([resource, amount]) => {
            const data = resourceData[resource as keyof typeof resourceData];
            const Icon = data.icon;
            const storage = resourceStorage[resource as keyof typeof resourceStorage] || 1000;
            const percentage = Math.round((amount / storage) * 100);

            return (
              <div key={resource} className="flex items-center space-x-1">
                <Icon className="w-5 h-5" style={{ color: data.color }} />
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-sm">{amount || 0}</span>
                  <div className="flex items-center space-x-1">
                    <Database className="w-2 h-2 text-slate-400" />
                    <span className="text-slate-400 text-xs">{storage}</span>
                    <span className={`text-xs ${
                      percentage >= 90 ? 'text-red-400' : 
                      percentage >= 75 ? 'text-yellow-400' : 
                      'text-slate-400'
                    }`}>
                      ({percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Population */}
          <div className="flex items-center space-x-1 border-l border-slate-600 pl-4">
            <Users className="w-5 h-5 text-blue-400" />
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm">{population}</span>
              <span className="text-slate-400 text-xs">/ {maxPopulation}</span>
            </div>
          </div>
        </div>

        {/* Turn Info */}
        <div className="flex items-center space-x-4 text-white">
          <div className="text-center">
            <div className="text-sm text-slate-300">Turn</div>
            <div className="text-xl font-bold">{currentTurn}</div>
          </div>

          <div className="text-center">
            <div className="text-sm text-slate-300">Action Points</div>
            <div className="text-xl font-bold text-blue-400">
              {actionPoints}/{maxActionPoints}
            </div>
          </div>

          {/* Building Effects Summary */}
          {buildingEffects.enabledFeatures.length > 0 && (
            <div className="text-center">
              <div className="text-sm text-slate-300">Active Features</div>
              <div className="text-sm text-green-400">
                {buildingEffects.enabledFeatures.length} enabled
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBuildingGuide(!showBuildingGuide)}
            className={`p-2 rounded-lg transition-colors ${
              showBuildingGuide 
                ? 'bg-amber-600 text-white' 
                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
            }`}
            title="Building Guide"
          >
            <BookOpen className="w-5 h-5" />
          </button>

          <button
            onClick={() => dispatch(toggleGrid())}
            className={`p-2 rounded-lg transition-colors ${
              showGrid 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
            }`}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-5 h-5" />
          </button>

          <button
            onClick={() => dispatch(toggleFogOfWar())}
            className={`p-2 rounded-lg transition-colors ${
              showFogOfWar 
                ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' 
                : 'bg-blue-600 text-white'
            }`}
            title="Toggle Fog of War"
          >
            {showFogOfWar ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>

          <button
            onClick={() => dispatch(nextTurn())}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
          >
            <Play className="w-4 h-4" />
            <span>End Turn</span>
          </button>
        </div>
      </div>

      {/* Hero Info Bar (if hero selected) */}
      {selectedHeroData && (
        <div className="bg-slate-900 border-t border-slate-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl">
                🧙
              </div>
              <div>
                <h3 className="text-white font-semibold">{selectedHeroData.name}</h3>
                <p className="text-slate-300 text-sm">
                  Level {selectedHeroData.level} {selectedHeroData.faction} Hero
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="text-slate-400">Movement</div>
                <div className="text-blue-400 font-semibold">
                  {selectedHeroData.movement}/{selectedHeroData.maxMovement}
                </div>
              </div>

              <div className="text-center">
                <div className="text-slate-400">Army Size</div>
                <div className="text-green-400 font-semibold">
                  {selectedHeroData.army.reduce((sum, unit) => sum + unit.count, 0)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-slate-400">Experience</div>
                <div className="text-purple-400 font-semibold">
                  {selectedHeroData.experience}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Storage Warning */}
      {Object.entries(resources).some(([resource, amount]) => {
        const storage = resourceStorage[resource as keyof typeof resourceStorage] || 1000;
        return amount >= storage * 0.9;
      }) && (
        <div className="bg-yellow-900 border-t border-yellow-700 px-4 py-2 z-40">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-200 text-sm">
              Warning: Some resources are near storage capacity. Upgrade storage buildings to increase limits.
            </span>
          </div>
        </div>
      )}

      {/* Building Guide Modal */}
      {showBuildingGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-slate-900 rounded-lg max-w-7xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowBuildingGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white z-70"
            >
              <span className="text-2xl">×</span>
            </button>
            <BuildingGuide />
          </div>
        </div>
      )}
    </div>
  );
};

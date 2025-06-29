import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { selectBuildingType, buildStructure, upgradeBuilding, renameCityAction, updateBuildingTimers, GameState } from '../../store/gameSlice';
import { factions, ResourceAmount } from '../../data/gameData';
import {BuildingType, getBuildingById, getBuildingLevelData} from '../../data/buildingsData';
import { checkBuildingCosts, checkBuildingPrerequisites, checkUpgradeRequirements } from '../../store/buildingSystem';
import { Building, Hammer, Clock, Coins, Trees, Mountain, ArrowUp, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Layers, Edit3, Check, X, Timer, Wrench, TrendingUp } from 'lucide-react';

export const BuildingPanel: React.FC = () => {
  const dispatch = useDispatch();
  const {
    playerFaction,
    selectedBuildingType,
    resources,
    resourceStorage,
    selectedTile,
    cities,
    actionPoints,
    availableBuildings,
    upgradeableBuildings,
    buildingEffects
  } = useSelector((state: RootState) => state.game);

  const faction = factions.find(f => f.id === playerFaction);
  const nearestCity = cities[0]; // Simplified - get nearest city
  const [showUpgrades, setShowUpgrades] = React.useState(false);
  const [expandedBuilding, setExpandedBuilding] = React.useState<string | null>(null);
  const [isEditingCityName, setIsEditingCityName] = React.useState(false);
  const [editedCityName, setEditedCityName] = React.useState(nearestCity?.name || '');
  const [currentTime, setCurrentTime] = React.useState(Date.now());

  React.useEffect(() => {
    setEditedCityName(nearestCity?.name || '');
  }, [nearestCity?.name]);

  // Update timers every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      dispatch(updateBuildingTimers());
    }, 1000);

    return () => clearInterval(interval);
  }, [dispatch]);

  if (!faction) return null;

  const handleBuild = (buildingType: BuildingType) => {
    if (selectedTile && nearestCity) {
      dispatch(buildStructure({
        coords: selectedTile,
        buildingType,
        cityId: nearestCity.id
      }));
      dispatch(selectBuildingType(null));
    }
  };

  const handleUpgrade = (buildingId: string) => {
    if (nearestCity) {
      dispatch(upgradeBuilding({
        buildingId,
        cityId: nearestCity.id
      }));
    }
  };

  const handleCityNameSave = () => {
    if (nearestCity && editedCityName.trim() && editedCityName.trim() !== nearestCity.name) {
      dispatch(renameCityAction({
        cityId: nearestCity.id,
        newName: editedCityName.trim()
      }));
    }
    setIsEditingCityName(false);
  };

  const handleCityNameCancel = () => {
    setEditedCityName(nearestCity?.name || '');
    setIsEditingCityName(false);
  };

  const getResourceIcon = (resource: string) => {
    switch (resource) {
      case 'gold': return Coins;
      case 'wood': return Trees;
      case 'ore': return Mountain;
      default: return Hammer;
    }
  };

  const renderResourceCost = (cost: ResourceAmount) => {
    return Object.entries(cost).map(([resource, required]) => {
      const available = resources[resource as keyof typeof resources] || 0;
      const sufficient = available >= required;
      const Icon = getResourceIcon(resource);

      return (
        <div key={resource} className="flex items-center space-x-1">
          <Icon className="w-3 h-3 text-slate-400" />
          <span className={`text-xs font-semibold ${
            sufficient ? 'text-white' : 'text-red-400'
          }`}>
            {required}
          </span>
        </div>
      );
    });
  };

  const buildingQueue = nearestCity?.buildings.filter(building =>
    (building.constructionStart && building.constructionTime && building.isUnderConstruction) ||
    (building.isUpgrading && building.upgradeStart && building.upgradeTime)
  ) || [];
  // console.log("BuildingPanel > city", nearestCity, "buildings", nearestCity?.buildings, "queue", buildingQueue);

  return (
    <div className="w-full">
      {/* City Header */}
      <div className="p-3 border-b border-slate-600 bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm">
              🏰
            </div>
            {isEditingCityName ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={editedCityName}
                  onChange={(e) => setEditedCityName(e.target.value)}
                  className="bg-slate-700 text-white text-sm px-2 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCityNameSave();
                    if (e.key === 'Escape') handleCityNameCancel();
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCityNameSave}
                  className="p-1 text-green-400 hover:text-green-300 transition-colors"
                  title="Save"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCityNameCancel}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div>
                  <h2 className="text-white font-semibold text-sm">{nearestCity?.name || 'City'}</h2>
                  <div className="text-slate-400 text-xs">Level {nearestCity?.level || 1}</div>
                </div>
                <button
                  onClick={() => setIsEditingCityName(true)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Rename City"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-slate-400">Buildings</div>
            <div className="text-white font-semibold">{nearestCity?.buildings.length || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-slate-400">Available</div>
            <div className="text-green-400 font-semibold">{availableBuildings.length}</div>
          </div>
          <div className="text-center">
            <div className="text-slate-400">Upgradeable</div>
            <div className="text-blue-400 font-semibold">{upgradeableBuildings.length}</div>
          </div>
        </div>
      </div>

      {/* Building Queue */}
      {(() => {
        if (buildingQueue.length === 0) return null;

        const formatTimeRemaining = (startTime: number, duration: number): string => {
          const remaining = Math.max(0, (startTime + duration) - currentTime);
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          return `${minutes}m ${seconds}s`;
        };

        const getProgressPercentage = (startTime: number, duration: number): number => {
          const elapsed = currentTime - startTime;
          return Math.min(100, Math.max(0, (elapsed / duration) * 100));
        };

        return (
          <div className="border-b border-slate-600 bg-slate-900">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm flex items-center">
                  <Timer className="w-4 h-4 mr-2 text-orange-400" />
                  Construction Queue ({buildingQueue.length})
                </h3>
              </div>

              <div className="space-y-2">
                {buildingQueue.map(building => {
                  const buildingData = getBuildingById(building.type);
                  if (!buildingData) return null;

                  const isConstruction = building.isUnderConstruction && building.constructionStart && building.constructionTime;
                  const isUpgrade = building.isUpgrading && building.upgradeStart && building.upgradeTime;

                  const startTime = isConstruction ? building.constructionStart! : building.upgradeStart!;
                  const duration = isConstruction ? building.constructionTime! : building.upgradeTime!;
                  const progress = getProgressPercentage(startTime, duration);
                  const timeRemaining = formatTimeRemaining(startTime, duration);

                  return (
                    <div key={building.id} className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {isConstruction ? (
                            <Wrench className="w-3 h-3 text-blue-400" />
                          ) : (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                          )}
                          <span className="text-white text-xs font-semibold">
                            {buildingData.name}
                          </span>
                          {isUpgrade && (
                            <span className="text-slate-400 text-xs">
                              L{building.level} → L{building.upgradeToLevel}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-300 text-xs">{timeRemaining}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-1000 ${
                              isConstruction ? 'bg-blue-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-xs w-10 text-right">
                          {Math.round(progress)}%
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {isConstruction ? 'Constructing...' : `Upgrading to Level ${building.upgradeToLevel}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mode Toggle */}
      <div className="p-3 border-b border-slate-600">
        <button
          onClick={() => setShowUpgrades(!showUpgrades)}
          className="w-full flex items-center justify-between text-white hover:text-blue-400 transition-colors"
        >
          <div className="flex items-center space-x-2">
            {showUpgrades ? <Layers className="w-4 h-4" /> : <Building className="w-4 h-4" />}
            <span className="font-semibold text-sm">
              {showUpgrades ? 'Upgrade Buildings' : 'Construct Buildings'}
            </span>
          </div>
          <ArrowUp className={`w-4 h-4 transition-transform ${showUpgrades ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Resource Summary */}
      <div className="p-2 bg-slate-900 border-b border-slate-600">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Storage:</span>
            <div className="text-white">
              {Object.entries(resourceStorage).map(([resource, limit]) => {
                const current = resources[resource as keyof typeof resources] || 0;
                const percentage = Math.round((current / limit) * 100);
                return (
                  <div key={resource} className={`${percentage >= 90 ? 'text-red-400' : ''}`}>
                    {resource}: {percentage}%
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Features:</span>
            <div className="text-green-400">
              {buildingEffects.enabledFeatures.length} active
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {!showUpgrades ? (
          // Construction Mode
          <>
            {availableBuildings.length === 0 && (
              <div className="p-4 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>No buildings available for construction</p>
                <p className="text-xs mt-1">Check prerequisites and resources</p>
              </div>
            )}

            {availableBuildings.map(buildingType => {
              const gameState = {
                playerFaction, resources, resourceStorage, selectedTile, cities, actionPoints,
                availableBuildings, upgradeableBuildings, buildingEffects
              } as GameState;
              const building = getBuildingById(buildingType);
              // console.log("BuildingPanel > availableBuildings > building", building);
              if (!building) return null;

              const levelData = getBuildingLevelData(buildingType);
              // console.log("BuildingPanel > availableBuildings > levelData", levelData);
              if (!levelData) return null;

              // @ts-expect-error ignore
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { canBuild, missingResources } = checkBuildingCosts(buildingType, gameState);
              // console.log(`BuildingPanel > availableBuildings [${buildingType}] > canBuild`, canBuild, missingResources);
              const selected = selectedBuildingType === buildingType;

              // Check prerequisites
              const { canBuild: meetsPrereqs, missingRequirements } = checkBuildingPrerequisites(buildingType, nearestCity, gameState);

              const finalCanBuild = canBuild && meetsPrereqs;
              // console.log(`BuildingPanel > availableBuildings [${buildingType}] > finalCanBuild`, finalCanBuild, "canBuild", canBuild, "meetsPrereqs", meetsPrereqs);

              return (
                <div
                  key={buildingType}
                  className={`border-b border-slate-700 transition-colors ${
                    selected 
                      ? 'bg-blue-900 border-blue-600' 
                      : finalCanBuild 
                        ? 'hover:bg-slate-700' 
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => {
                      if (finalCanBuild) {
                        dispatch(selectBuildingType(selected ? null : buildingType));
                      }
                      setExpandedBuilding(expandedBuilding === buildingType ? null : buildingType);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-semibold text-sm">{building.name}</h3>
                      <div className="flex items-center space-x-2">
                        {selected && <div className="w-2 h-2 bg-blue-400 rounded-full"></div>}
                        {expandedBuilding === buildingType ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Compact info */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-400">{levelData.buildTime}m</span>
                        <Hammer className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-400">{levelData.apCost || 1} AP</span>
                      </div>
                      {!finalCanBuild && (
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      )}
                    </div>

                    {/* Expanded details */}
                    {expandedBuilding === buildingType && (
                      <div className="mt-3 pt-3 border-t border-slate-600">
                        <p className="text-slate-300 text-xs mb-2">{building.description}</p>

                        {/* Prerequisites */}
                        {missingRequirements.length > 0 && (
                          <div className="mb-2 text-xs text-red-400">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Missing: {missingRequirements.join(', ')}
                          </div>
                        )}

                        {/* Cost */}
                        <div className="flex items-center space-x-2 mb-2">
                          {renderResourceCost(levelData.resourcesCost)}
                        </div>

                        {/* Production */}
                        {levelData.effects && levelData.effects.resourceProduction && (
                          <div className="text-xs text-green-400 mb-2">
                            Produces: {Object.entries(levelData.effects.resourceProduction).map(([resource, amount]) =>
                              `${amount} ${resource}`
                            ).join(', ')} per turn
                          </div>
                        )}

                        {/* Build Button */}
                        {selected && selectedTile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuild(buildingType);
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded transition-colors"
                            disabled={!finalCanBuild}
                          >
                            Build Here
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          // Upgrade Mode
          <>
            {nearestCity.buildings.length === 0 && (
              <div className="p-4 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No buildings to upgrade</p>
              </div>
            )}

            {nearestCity.buildings.map(building => {
              const gameState = {
                playerFaction, resources, resourceStorage, selectedTile, cities, actionPoints,
                availableBuildings, upgradeableBuildings, buildingEffects
              } as GameState;
              const buildingData = getBuildingById(building.type);
              if (!buildingData) return null;

              const nextLevel = building.level + 1;
              const nextLevelData = getBuildingLevelData(building.type, nextLevel);
              if (!nextLevelData) return null;

              const { canUpgrade, missingRequirements } = checkUpgradeRequirements(building, nearestCity, gameState);
              const { canBuild: canUpgrade2 } = checkBuildingCosts(building.type, gameState, nextLevel);
              const finalCanUpgrade = canUpgrade && canUpgrade2;

              return (
                <div
                  key={building.id}
                  className={`border-b border-slate-700 ${
                    finalCanUpgrade ? 'hover:bg-slate-700' : 'opacity-50'
                  }`}
                >
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => setExpandedBuilding(expandedBuilding === building.id ? null : building.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-semibold text-sm">
                        {buildingData.name} L{building.level}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {building.isUpgrading && (
                          <div className="text-yellow-400 text-xs">Upgrading...</div>
                        )}
                        {building.isUnderConstruction && (
                          <div className="text-blue-400 text-xs">Building...</div>
                        )}
                        {building.level >= building.maxLevel && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                        {expandedBuilding === building.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Progress bar for max level */}
                    <div className="w-full bg-slate-700 rounded-full h-1 mb-2">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(building.level / building.maxLevel) * 100}%` }}
                      />
                    </div>

                    <div className="text-xs text-slate-400">
                      Level {building.level}/{building.maxLevel}
                    </div>

                    {/* Expanded upgrade details */}
                    {expandedBuilding === building.id && building.level < building.maxLevel && (
                      <div className="mt-3 pt-3 border-t border-slate-600">
                        <div className="text-xs text-slate-300 mb-2">
                          Upgrade to Level {nextLevel}
                        </div>

                        {/* Prerequisites */}
                        {missingRequirements.length > 0 && (
                          <div className="mb-2 text-xs text-red-400">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Missing: {missingRequirements.join(', ')}
                          </div>
                        )}

                        {/* Upgrade Cost */}
                        <div className="flex items-center space-x-2 mb-2">
                          {renderResourceCost(nextLevelData.resourcesCost)}
                          <div className="flex items-center space-x-1">
                            <Hammer className="w-3 h-3 text-slate-400" />
                            <span className={`text-xs font-semibold ${
                              actionPoints >= nextLevelData.apCost ? 'text-white' : 'text-red-400'
                            }`}>
                              {nextLevelData.apCost} AP
                            </span>
                          </div>
                        </div>

                        {/* Upgrade Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpgrade(building.id);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!finalCanUpgrade || building.isUpgrading || building.isUnderConstruction}
                        >
                          {building.isUpgrading ? 'Upgrading...' :
                           building.isUnderConstruction ? 'Under Construction' :
                           `Upgrade to L${nextLevel}`}
                        </button>
                      </div>
                    )}

                    {building.level >= building.maxLevel && (
                      <div className="text-green-400 text-xs mt-2">
                        Maximum level reached
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {selectedBuildingType && !selectedTile && (
        <div className="p-3 bg-yellow-900 border-t border-yellow-700">
          <p className="text-yellow-200 text-xs">
            Select a tile to place the building
          </p>
        </div>
      )}
    </div>
  );
};

// Separate component for minimized building panel
export const MinimizedBuildingPanel: React.FC = () => {
  const { availableBuildings, upgradeableBuildings, cities } = useSelector((state: RootState) => state.game);
  const nearestCity = cities[0];

  // Get buildings in queue
  const buildingQueue = nearestCity?.buildings.filter(building =>
    (building.constructionStart && building.constructionTime) ||
    (building.isUpgrading && building.upgradeStart && building.upgradeTime)
  ) || [];

  return (
    <div className="w-full p-2">
      <div className="flex flex-col items-center space-y-2">
        <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm">
          🏰
        </div>
        <div className="text-center">
          <div className="text-white text-xs font-semibold">{nearestCity?.name || 'City'}</div>
          <div className="text-slate-400 text-xs">L{nearestCity?.level || 1}</div>
        </div>
        <div className="flex flex-col items-center space-y-1 text-xs">
          <div className="text-green-400">{availableBuildings.length} available</div>
          <div className="text-blue-400">{upgradeableBuildings.length} upgradeable</div>
          {buildingQueue.length > 0 && (
            <div className="text-orange-400">{buildingQueue.length} in queue</div>
          )}
          <div className="text-slate-400">{nearestCity?.buildings.length || 0} total</div>
        </div>
      </div>
    </div>
  );
};

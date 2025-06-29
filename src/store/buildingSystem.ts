import { ResourceAmount } from '../data/gameData';
import { Building, City, GameState } from './gameSlice';
import { buildingDatabase, BuildingType, getBuildingById, getBuildingLevelData } from "../data/buildingsData";

// Check if building prerequisites are met
export const checkBuildingPrerequisites = (
  buildingType: BuildingType,
  city: City,
  gameState: GameState
): { canBuild: boolean; missingRequirements: string[] } => {
  const building = getBuildingById(buildingType);
  if (!building) {
    console.error("buildingSystem > Building not found", buildingType);
    return { canBuild: false, missingRequirements: ['Unknown building type'] };
  }

  const missingRequirements: string[] = [];
  const constraints = building.levels[0].constraints;

  if (constraints) {
    // Check required buildings
    if (constraints.requiredBuildings) {
      Object.entries(constraints.requiredBuildings).forEach(([requiredType, requiredLevel]) => {
        const existingBuilding = city.buildings.find(b => b.type === requiredType);
        if (!existingBuilding || existingBuilding.level < requiredLevel) {
          missingRequirements.push(`${requiredType} level ${requiredLevel}`);
        }
      });
    }

    // Check population requirements
    if (constraints.requiredPopulation && gameState.population < constraints.requiredPopulation) {
      missingRequirements.push(`Population: ${constraints.requiredPopulation}`);
    }

    // Check city level requirements
    if (constraints.requiredCityLevel && city.level < constraints.requiredCityLevel) {
      missingRequirements.push(`City level: ${constraints.requiredCityLevel}`);
    }

    // Check mutually exclusive buildings
    if (constraints.mutuallyExclusive) {
      const conflictingBuildings = city.buildings.filter(b =>
        constraints.mutuallyExclusive!.includes(b.type)
      );
      if (conflictingBuildings.length > 0) {
        missingRequirements.push(`Cannot coexist with: ${conflictingBuildings.map(b => b.type).join(', ')}`);
      }
    }
  }

  // console.log("buildingSystem >", buildingType, "canBuild", missingRequirements.length === 0, "missingRequirements", missingRequirements);

  return {
    canBuild: missingRequirements.length === 0,
    missingRequirements
  };
};

export const checkBuildingCosts = (
  buildingType: BuildingType,
  gameState: GameState,
  level: number = 1,
  consume: boolean = false
): { canBuild: boolean; missingResources: string[] } => {
  const building = getBuildingById(buildingType);
  if (!building) {
    return { canBuild: false, missingResources: [`Unknown building type [${buildingType}]`] };
  }

  const missingResources: string[] = [];

  const levelData = getBuildingLevelData(buildingType, level);

  if (!levelData) {
    return { canBuild: false, missingResources: [`Unknown level [${level}]`] };
  }

  const canAffordResources = Object.keys(levelData.resourcesCost).every(resource => {
    const required = levelData.resourcesCost[resource as keyof ResourceAmount] || 0;
    const available = gameState.resources[resource as keyof ResourceAmount] || 0;
    return available >= required;
  });

  const apCost = levelData.apCost || (level + 1);
  const canAffordAP = gameState.actionPoints >= apCost;

  if (!canAffordResources || !canAffordAP) {
    // Cannot afford the building
    if (!canAffordResources) {
      missingResources.push("Not enough resources");
    }

    if (!canAffordAP) {
      missingResources.push("Not enough AP");
    }

    return { canBuild: false, missingResources };
  }

  if (consume) {
    // Consume resources
    Object.keys(levelData.resourcesCost).forEach(resource => {
      const cost = levelData.resourcesCost[resource as keyof ResourceAmount] || 0;
      const current = gameState.resources[resource as keyof ResourceAmount] || 0;
      gameState.resources[resource as keyof ResourceAmount] = Math.max(0, current - cost);
    });

    // Consume AP
    gameState.actionPoints -= apCost;
  }

  return {
    canBuild: true,
    missingResources: []
  };
};

// Check if building can be upgraded
export const checkUpgradeRequirements = (
  building: Building,
  city: City,
  // @ts-expect-error ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gameState: GameState
): { canUpgrade: boolean; missingRequirements: string[] } => {
  const buildingInfo = getBuildingById(building.type);
  if (!buildingInfo) {
    return { canUpgrade: false, missingRequirements: ['Unknown building type'] };
  }

  const missingRequirements: string[] = [];

  // Check if already at max level
  if (building.level >= building.maxLevel) {
    missingRequirements.push('Already at maximum level');
  }

  // Check if currently under construction or upgrading
  if (building.isUnderConstruction || building.isUpgrading) {
    missingRequirements.push('Building is currently under construction/upgrade');
  }

  // For higher levels, check additional prerequisites
  const nextLevel = building.level + 1;
  const nextLevelData = getBuildingLevelData(building.type, nextLevel);

  if (!nextLevelData) return { canUpgrade: false, missingRequirements: ['Could not find next level data'] };

  const nextLevelEffects = nextLevelData.effects;

  if (nextLevelEffects) {
    // Some buildings require other buildings to be upgraded first
    // TODO: Make this dynamic based on building requirements
    if (building.type === 'town_hall' && nextLevel >= 2) {
      const requiredBuildings = ['barracks'];
      if (nextLevel >= 3) requiredBuildings.push('marketplace');
      if (nextLevel >= 4) requiredBuildings.push('mage_guild', 'blacksmith');
      if (nextLevel >= 5) requiredBuildings.push('archery_range');

      requiredBuildings.forEach(reqType => {
        const reqBuilding = city.buildings.find(b => b.type === reqType);
        if (!reqBuilding || reqBuilding.level < 1) {
          missingRequirements.push(`Requires ${reqType} level 1`);
        }
      });
    }
  }

  return {
    canUpgrade: missingRequirements.length === 0,
    missingRequirements
  };
};

// Apply building effects to game state
export const applyBuildingEffects = (
  buildingType: BuildingType,
  level: number,
  gameState: GameState,
  isRemoving: boolean = false
): GameState => {
  const buildingInfo = getBuildingById(buildingType);
  if (!buildingInfo) return gameState;

  const levelData = getBuildingLevelData(buildingType, level);

  if (!levelData) return gameState;

  const effects = levelData.effects;
  if (!effects) return gameState;

  const multiplier = isRemoving ? -1 : 1;

  // Apply resource production changes
  if (effects.resourceProduction) {
    Object.entries(effects.resourceProduction).forEach(([resource, amount]) => {
      const key = resource as keyof ResourceAmount;
      const currentProduction = gameState.cities[0]?.production[key] || 0;
      if (gameState.cities[0]) {
        gameState.cities[0].production[key] = Math.max(0, currentProduction + (amount * multiplier));
      }
    });
  }

  // Apply resource storage changes
  if (effects.resourceStorage) {
    Object.entries(effects.resourceStorage).forEach(([resource, amount]) => {
      const key = resource as keyof ResourceAmount;
      const currentStorage = gameState.resourceStorage[key] || 0;
      gameState.resourceStorage[key] = Math.max(1000, currentStorage + (amount * multiplier));
    });
  }

  // Apply population changes
  if (effects.maxPopulationIncrease) {
    gameState.maxPopulation = Math.max(100, gameState.maxPopulation + (effects.maxPopulationIncrease * multiplier));
  }

  // Enforce resource storage limits
  Object.entries(gameState.resources).forEach(([resource, amount]) => {
    const key = resource as keyof ResourceAmount;
    const storageLimit = gameState.resourceStorage[key] || 1000;
    if (amount > storageLimit) {
      gameState.resources[key] = storageLimit;
    }
  });

  return gameState;
};

// Get total building effects for a city
export const calculateCityEffects = (city: City): {
  totalProduction: ResourceAmount;
  totalStorage: ResourceAmount;
  totalPopulationCapacity: number;
  enabledFeatures: string[];
  totalBonuses: { [key: string]: number };
} => {
  const totalProduction: ResourceAmount = {};
  const totalStorage: ResourceAmount = { gold: 1000, wood: 1000, ore: 1000, gems: 1000, crystal: 1000 };
  let totalPopulationCapacity = 100; // Base from Town Hall L1
  const enabledFeatures: string[] = [];
  const totalBonuses: { [key: string]: number } = {};

  city.buildings.forEach(building => {
    // Only apply effects for completed buildings
    if (building.isUnderConstruction || building.isUpgrading) {
      return;
    }

    const buildingInfo = getBuildingById(building.type);
    if (!buildingInfo) return;


    const levelData = getBuildingLevelData(building.type, building.level);

    if (!levelData) return;
    const effects = levelData.effects;
    if (!effects) return;

    // Accumulate production
    if (effects.resourceProduction) {
      Object.entries(effects.resourceProduction).forEach(([resource, amount]) => {
        const key = resource as keyof ResourceAmount;
        totalProduction[key] = (totalProduction[key] || 0) + amount;
      });
    }

    // Accumulate storage
    if (effects.resourceStorage) {
      Object.entries(effects.resourceStorage).forEach(([resource, amount]) => {
        const key = resource as keyof ResourceAmount;
        totalStorage[key] = (totalStorage[key] || 0) + amount;
      });
    }

    // Accumulate population capacity
    if (effects.maxPopulationIncrease) {
      totalPopulationCapacity += effects.maxPopulationIncrease;
    }

    // Collect enabled features
    if (effects.enablesFeatures) {
      enabledFeatures.push(...effects.enablesFeatures);
    }

    // Accumulate bonuses
    if (effects.unitUpgradeBonus) {
      totalBonuses.unitUpgrade = (totalBonuses.unitUpgrade || 0) + effects.unitUpgradeBonus;
    }
    if (effects.recruitmentSpeedBonus) {
      totalBonuses.recruitmentSpeed = (totalBonuses.recruitmentSpeed || 0) + effects.recruitmentSpeedBonus;
    }
    if (effects.manaRegeneration) {
      totalBonuses.manaRegen = (totalBonuses.manaRegen || 0) + effects.manaRegeneration;
    }
    if (effects.tradeEfficiency) {
      totalBonuses.tradeEfficiency = Math.max(totalBonuses.tradeEfficiency || 0, effects.tradeEfficiency);
    }
  });

  return {
    totalProduction,
    totalStorage,
    totalPopulationCapacity,
    enabledFeatures: [...new Set(enabledFeatures)], // Remove duplicates
    totalBonuses
  };
};

// Check if a feature is enabled by buildings
export const isFeatureEnabled = (feature: string, city: City): boolean => {
  const cityEffects = calculateCityEffects(city);
  return cityEffects.enabledFeatures.includes(feature);
};

// Get available buildings for construction
export const getAvailableBuildings = (city: City, gameState: GameState): string[] => {
  const availableBuildings: string[] = [];

  Object.entries(buildingDatabase).forEach(([,buildingData]) => {
    // Check if building already exists
    const buildingType = buildingData.id;
    const existingBuilding = city.buildings.find(b => b.type === buildingType);
    if (existingBuilding) return; // Building already exists

    // Check prerequisites
    const { canBuild } = checkBuildingPrerequisites(buildingType, city, gameState);
    if (canBuild) {
      availableBuildings.push(buildingType);
    }
  });

  return availableBuildings;
};

// Get buildings available for upgrade
export const getUpgradeableBuildings = (city: City, gameState: GameState): Building[] => {
  return city.buildings.filter(building => {
    const { canUpgrade } = checkUpgradeRequirements(building, city, gameState);
    return canUpgrade;
  });
};

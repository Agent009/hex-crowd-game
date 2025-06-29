import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CubeCoords, HexTile, Hero, coordsToKey, generateHexSpiral } from '../utils/hexGrid';
import { factions, gameSize, resourceData, ResourceType, ResourceAmount } from '../data/gameData';
import { BuildingType, getBuildingById, getBuildingLevelData } from "../data/buildingsData";
import {
  applyBuildingEffects,
  calculateCityEffects, checkBuildingCosts,
  checkBuildingPrerequisites, checkUpgradeRequirements,
  getAvailableBuildings,
  getUpgradeableBuildings
} from './buildingSystem';

// Building effects interface
export interface BuildingEffectsSummary {
  enabledFeatures: string[];
  totalBonuses: ResourceAmount;
}

// Helper function to determine resource collection amount
const getResourceAmount = (resourceType: string): number => {
  const baseAmounts = {
    gold: 500,
    wood: 10,
    ore: 8,
    gems: 3,
    crystal: 2
  };
  return baseAmounts[resourceType as keyof typeof baseAmounts] || 0;
};

// Helper function to get terrain movement cost
const getTerrainMoveCost = (terrain: string): number => {
  const terrainCosts = {
    grass: 1,
    forest: 2,
    mountain: 3,
    water: 999, // Cannot move through
    desert: 2,
    swamp: 3
  };
  return terrainCosts[terrain as keyof typeof terrainCosts] || 1;
};

export interface GameState {
  // World state
  tiles: { [key: string]: HexTile };
  worldSize: number;
  selectedTile: CubeCoords | null;
  selectedHero: string | null;
  
  // Player state
  playerId: string;
  playerFaction: string;
  resources: ResourceAmount;
  resourceStorage: ResourceAmount; // Storage limits for each resource
  population: number;
  maxPopulation: number;
  heroes: Hero[];
  cities: City[];
  
  // Game state
  currentTurn: number;
  gamePhase: 'exploration' | 'combat' | 'building' | 'ended';
  actionPoints: number;
  maxActionPoints: number;
  
  // Building system state
  buildingEffects: BuildingEffectsSummary;
  availableBuildings: string[];
  upgradeableBuildings: string[];
  
  // UI state
  showGrid: boolean;
  cameraPosition: { x: number; y: number };
  zoomLevel: number;
  selectedBuildingType: string | null;
  showFogOfWar: boolean;
}

export interface City {
  id: string;
  name: string;
  coords: CubeCoords;
  faction: string;
  level: number;
  buildings: Building[];
  production: ResourceAmount;
  garrison: [];
}

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  maxLevel: number;
  constructionStart?: number;
  constructionTime?: number;
  isUpgrading?: boolean;
  upgradeStart?: number;
  upgradeTime?: number;
  upgradeToLevel?: number;
  isUnderConstruction?: boolean;
}

const generateInitialWorld = (size: number): { [key: string]: HexTile } => {
  const tiles: { [key: string]: HexTile } = {};
  const center: CubeCoords = { q: 0, r: 0, s: 0 };

  // Generate hex grid using proper spiral generation
  const coords = generateHexSpiral(center, size);

  coords.forEach(coord => {
    const key = coordsToKey(coord);
    const distance = Math.max(Math.abs(coord.q), Math.abs(coord.r), Math.abs(coord.s));

    // Generate terrain based on distance and randomization
    let terrain: HexTile['terrain'] = 'grass';
    const rand = Math.random();

    // Terrain Generation Logic Explanation
    //      Mountains/Forests
    //     /                  \
    //    /   Varied Terrain    \
    //   |                       |
    //   |    Mostly Grassland   |
    //   |         (Start)       |
    //    \                     /
    //     \                   /
    //      -------------------
    // Players start in a safe, resource-rich grassland area
    // As they explore outward, they encounter more varied and challenging terrain
    // The outer edges of the map have natural barriers (mountains) that create boundaries
    // - Mountain: 80% chance
    // - Forest: 60% chance
    // - Grass: 20% chance
    // - Water: 10% chance
    // - Desert: 5% chance
    // - Swamp: 5% chance
    // - Starting area (distance <= 1): Always explored, with some partially visible tiles around it
    // - Near starting area (distance <= 3): Partially visible, but fogged
    // - Resource tiles (distance > 1): 10% chance of having a resource
    // - Resource tiles near starting area (distance > 1): 10% chance of having a resource
    // - Resource tiles near starting area (distance > 3): 5% chance of having a resource
    // - Resource tiles near starting area (distance > 5): 1% chance of having a resource
    if (distance > size * 0.8) {
      // Outer Ring (distance > 80% of map size)
      // Create mountainous borders around the edge of the world.
      // 30% chance of mountains
      // 30% chance of forests (when 0.3 ≤ rand < 0.6)
      // 40% chance of grassland (when rand ≥ 0.6)
      terrain = rand < 0.3 ? 'mountain' : rand < 0.6 ? 'forest' : 'grass';
    } else if (distance > size * 0.5) {
      // Middle Ring (50% to 80% of map size)
      // This middle area has more varied terrain with a good mix of different biomes.
      // 20% chance of forests
      // 20% chance of water (lakes/rivers)
      // 10% chance of desert (only when 0.4 ≤ rand < 0.5)
      // 50% chance of grassland
      terrain = rand < 0.4 ? 'mountain' : rand < 0.5 ? 'forest' : 'grass';
      terrain = rand < 0.2 ? 'forest' : rand < 0.4 ? 'water' : rand < 0.1 ? 'desert' : 'grass';
    } else {
      // Inner Ring (center to 50% of map size)
      // The center of the map is predominantly grassland, making it ideal for starting locations and early exploration.
      // 10% chance of forests
      // 5% chance of water (small ponds)
      // 85% chance of grassland
      terrain = rand < 0.1 ? 'forest' : rand < 0.05 ? 'water' : 'grass';
    }

    // Starting area is always explored, with some partially visible tiles around it
    const isStartingArea = distance <= 1;
    const isNearStartingArea = distance <= 3;

    tiles[key] = {
      coords: coord,
      terrain,
      explored: isStartingArea,
      visible: isNearStartingArea,
      fogLevel: isStartingArea ? 2 : (isNearStartingArea ? 1 : 0),
      // Only 10% of tiles (Math.random() < 0.1) will have a resource
      // Only tiles that are more than 1 unit away from the center (distance > 1) can have resources
      ...(Math.random() < 0.1 && distance > 1 && {
        // When these conditions are met, a random resource type is assigned to the tile
        resource: Object.keys(resourceData)[Math.floor(Math.random() * Object.keys(resourceData).length)] as ResourceType
      })
    };
  });

  // Place the hero at the center
  const centerKey = coordsToKey(center);
  if (tiles[centerKey]) {
    // Place the town hall building at the center tile
    tiles[centerKey].building = 'town_hall' as BuildingType;

    tiles[centerKey].hero = {
      id: 'hero1',
      name: 'Roland',
      faction: 'haven',
      level: 1,
      experience: 0,
      movement: 1560,
      maxMovement: 1560,
      army: [
        { id: 'unit1', type: 'peasant', hp: 4, maxHp: 4, attack: 1, defense: 1, speed: 3, count: 20 },
        { id: 'unit2', type: 'archer', hp: 10, maxHp: 10, attack: 6, defense: 3, speed: 4, count: 5 }
      ],
      inventory: []
    };
  }

  return tiles;
};

const initialState: GameState = {
  tiles: generateInitialWorld(gameSize),
  worldSize: gameSize,
  selectedTile: null,
  selectedHero: 'hero1', // Auto-select the first hero

  playerId: 'player1',
  playerFaction: 'haven',
  resources: { gold: 10000, wood: 30, ore: 20, gems: 5, crystal: 5 },
  resourceStorage: { gold: 1000, wood: 1000, ore: 1000, gems: 1000, crystal: 1000 },
  population: 25, // Starting population from hero army
  maxPopulation: 100, // Starting from Town Hall L1
  heroes: [
    {
      id: 'hero1',
      name: 'Roland',
      faction: 'haven',
      level: 1,
      experience: 0,
      movement: 1560,
      maxMovement: 1560,
      army: [
        { id: 'unit1', type: 'peasant', hp: 4, maxHp: 4, attack: 1, defense: 1, speed: 3, count: 20 },
        { id: 'unit2', type: 'archer', hp: 10, maxHp: 10, attack: 6, defense: 3, speed: 4, count: 5 }
      ],
      inventory: []
    }
  ],
  cities: [
    {
      id: 'city1',
      name: 'Haven Capital',
      coords: { q: 0, r: 0, s: 0 },
      faction: 'haven',
      level: 1,
      buildings: [
        { id: 'building1', type: 'town_hall', level: 1, maxLevel: 5 }
      ],
      production: { gold: 500 },
      garrison: []
    }
  ],

  currentTurn: 1,
  gamePhase: 'exploration',
  actionPoints: 10,
  maxActionPoints: 10,

  buildingEffects: {
    enabledFeatures: [],
    totalBonuses: { gold: 0, wood: 0, ore: 0, gems: 0, crystal: 0 }
  },
  availableBuildings: [],
  upgradeableBuildings: [],

  showGrid: true,
  cameraPosition: { x: 0, y: 0 },
  zoomLevel: 1,
  selectedBuildingType: null,
  showFogOfWar: true
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    selectTile: (state, action: PayloadAction<CubeCoords>) => {
      state.selectedTile = action.payload;
    },

    selectHero: (state, action: PayloadAction<string | null>) => {
      state.selectedHero = action.payload;
    },

    moveHero: (state, action: PayloadAction<{ heroId: string; target: CubeCoords; path: CubeCoords[] }>) => {
      const { heroId, target, path } = action.payload;
      const hero = state.heroes.find(h => h.id === heroId);
      const targetKey = coordsToKey(target);
      const targetTile = state.tiles[targetKey];

      if (hero && targetTile && path.length > 0) {
        // Calculate movement cost based on terrain
        let moveCost = 0;
        let apCost = 0;

        // Calculate total movement and AP cost for the path
        for (let i = 1; i < path.length; i++) {
          const stepKey = coordsToKey(path[i]);
          const stepTile = state.tiles[stepKey];
          if (stepTile) {
            const terrainMoveCost = getTerrainMoveCost(stepTile.terrain);
            moveCost += terrainMoveCost * 100; // Movement points
            apCost += terrainMoveCost; // Action points
          }
        }

        // Check if hero has enough movement and player has enough AP
        if (hero.movement >= moveCost && state.actionPoints >= apCost) {
          hero.movement -= moveCost;
          state.actionPoints -= apCost;

          // Remove hero from current tile
          Object.keys(state.tiles).forEach(key => {
            if (state.tiles[key].hero?.id === heroId) {
              delete state.tiles[key].hero;
            }
          });

          // Place hero on target tile
          targetTile.hero = hero;

          // Collect resources from the target tile
          if (targetTile.resource && !targetTile.resourceDepleted) {
            const resourceAmount = getResourceAmount(targetTile.resource);
            const currentAmount = state.resources[targetTile.resource] || 0;
            state.resources[targetTile.resource] = currentAmount + resourceAmount;

            // Mark resource as collected (but keep it visible for now)
            targetTile.resourceDepleted = true;

            // Trigger resource discovery animation
            // This will be handled by the GameCanvas component
          }

          // Explore target tile and surrounding area
          targetTile.explored = true;
          targetTile.visible = true;
          targetTile.fogLevel = 2;

          // Reveal adjacent tiles around the target position
          const adjacentTiles = [
            { q: target.q + 1, r: target.r - 1, s: target.s },
            { q: target.q + 1, r: target.r, s: target.s - 1 },
            { q: target.q, r: target.r + 1, s: target.s - 1 },
            { q: target.q - 1, r: target.r + 1, s: target.s },
            { q: target.q - 1, r: target.r, s: target.s + 1 },
            { q: target.q, r: target.r - 1, s: target.s + 1 }
          ];

          adjacentTiles.forEach(adjCoord => {
            const adjKey = coordsToKey(adjCoord);
            if (state.tiles[adjKey] && state.tiles[adjKey].fogLevel < 2) {
              state.tiles[adjKey].visible = true;
              state.tiles[adjKey].fogLevel = Math.max(1, state.tiles[adjKey].fogLevel); // At least partially visible
            }
          });
        }
      }
    },

    exploreTile: (state, action: PayloadAction<CubeCoords>) => {
      const key = coordsToKey(action.payload);
      const tile = state.tiles[key];

      if (tile && tile.fogLevel < 2) {
        tile.explored = true;
        tile.visible = true;
        tile.fogLevel = 2;

        // Collect resources from the explored tile
        if (tile.resource && !tile.resourceDepleted) {
          const resourceAmount = getResourceAmount(tile.resource);
          const currentAmount = state.resources[tile.resource] || 0;
          state.resources[tile.resource] = currentAmount + resourceAmount;

          // Mark resource as collected
          tile.resourceDepleted = true;
        }

        // Reveal adjacent tiles with partial visibility
        const adjacentTiles = [
          { q: action.payload.q + 1, r: action.payload.r - 1, s: action.payload.s },
          { q: action.payload.q + 1, r: action.payload.r, s: action.payload.s - 1 },
          { q: action.payload.q, r: action.payload.r + 1, s: action.payload.s - 1 },
          { q: action.payload.q - 1, r: action.payload.r + 1, s: action.payload.s },
          { q: action.payload.q - 1, r: action.payload.r, s: action.payload.s + 1 },
          { q: action.payload.q, r: action.payload.r - 1, s: action.payload.s + 1 }
        ];

        adjacentTiles.forEach(adjCoord => {
          const adjKey = coordsToKey(adjCoord);
          if (state.tiles[adjKey] && state.tiles[adjKey].fogLevel === 0) {
            state.tiles[adjKey].visible = true;
            state.tiles[adjKey].fogLevel = 1; // Partially visible
          }
        });

        if (state.actionPoints > 0) {
          state.actionPoints -= 1;
        }
      }
    },

    buildStructure: (state, action: PayloadAction<{ coords: CubeCoords; buildingType: BuildingType; cityId: string }>) => {
      const { coords, buildingType, cityId } = action.payload;
      const key = coordsToKey(coords);
      const city = state.cities.find(c => c.id === cityId);

      // Find building data from faction buildings
      const playerFaction = factions.find(f => f.id === state.playerFaction);
      const canBuild = playerFaction?.buildings.includes(buildingType);

      if (!canBuild) {
        console.log(`GameSlice > buildStructure > faction [${playerFaction}] cannot build`, buildingType);
        return;
      }

      const buildingData = getBuildingById(buildingType);

      if (state.tiles[key] && city && !state.tiles[key].building && buildingData) {
        // Check prerequisites
        const { canBuild, missingRequirements } = checkBuildingPrerequisites(buildingType, city, state);
        if (!canBuild) {
          console.log(`GameSlice > buildStructure > faction [${playerFaction}] cannot build`, buildingType, missingRequirements);
          return;
        }

        // Check if player can afford the building
        const level1Data = getBuildingLevelData(buildingType);
        const canBuild2 = checkBuildingCosts(buildingType, state, 1, true);
        if (!canBuild2 || !canBuild2.canBuild) {
          console.log(`GameSlice > buildStructure > faction [${playerFaction}] cannot build`, buildingType, canBuild2.missingResources);
          return;
        }

        // Place the building
        state.tiles[key].building = buildingType as BuildingType;

        // Add building to city
        city.buildings.push({
          id: `building_${Date.now()}`,
          type: buildingType,
          level: 1,
          maxLevel: buildingData.maxLevel || 3,
          constructionStart: Date.now(),
          constructionTime: (level1Data?.buildTime || 1) * 60 * 1000, // In minutes
          isUnderConstruction: true
        });

        // Apply building effects immediately (for now - could be delayed until construction completes)
        // applyBuildingEffects(buildingType, 1, state);

        // Update available buildings and city effects
        state.availableBuildings = getAvailableBuildings(city, state);
        state.upgradeableBuildings = getUpgradeableBuildings(city, state).map(b => b.id);

        const cityEffects = calculateCityEffects(city);
        state.buildingEffects = {
          enabledFeatures: cityEffects.enabledFeatures,
          totalBonuses: cityEffects.totalBonuses
        };

        // Update city production and storage limits
        city.production = cityEffects.totalProduction;
        state.resourceStorage = cityEffects.totalStorage;
        state.maxPopulation = cityEffects.totalPopulationCapacity;
      }
    },

    upgradeBuilding: (state, action: PayloadAction<{ buildingId: string; cityId: string }>) => {
      const { buildingId, cityId } = action.payload;
      const city = state.cities.find(c => c.id === cityId);
      const building = city?.buildings.find(b => b.id === buildingId);

      if (building && city) {
        // Check upgrade requirements
        const { canUpgrade, missingRequirements } = checkUpgradeRequirements(building, city, state);
        if (!canUpgrade) {
          console.log('Cannot upgrade:', missingRequirements);
          return;
        }

        // Get upgrade costs (next level costs)
        const buildingInfo = getBuildingById(building.type);
        if (!buildingInfo) return;

        const nextLevel = building.level + 1;
        const nextLevelData = getBuildingLevelData(building.type, nextLevel);

        if (!nextLevelData) return;

        const canUpgrade2 = checkBuildingCosts(building.type, state, nextLevel, true);
        if (!canUpgrade2 || !canUpgrade2.canBuild) {
          console.log(`GameSlice > buildStructure > cannot upgrade building`, building.type, canUpgrade2.missingResources);
          return;
        }

        // Remove old level effects
        // applyBuildingEffects(building.type, building.level, state, true);

        // Upgrade the building
        building.level = nextLevel;
        building.isUpgrading = true;
        building.upgradeStart = Date.now();
        building.upgradeTime = nextLevelData?.buildTime || (5 * 60 * 1000 * building.level); // 5 minutes per level if undefined

        // DO NOT apply new level effects yet - they will be applied when upgrade completes

        // Update available buildings
        state.availableBuildings = getAvailableBuildings(city, state);
        state.upgradeableBuildings = getUpgradeableBuildings(city, state).map(b => b.id);
      }
    },

    updateResources: (state, action: PayloadAction<ResourceAmount>) => {
      Object.keys(action.payload).forEach(resource => {
        const key = resource as keyof ResourceAmount;
        const current = state.resources[key] || 0;
        const change = action.payload[key] || 0;
        const storageLimit = state.resourceStorage[key] || 1000;
        state.resources[key] = Math.max(0, Math.min(storageLimit, current + change));
      });
    },

    nextTurn: (state) => {
      state.currentTurn += 1;
      state.actionPoints = state.maxActionPoints;

      // Reset hero movement
      state.heroes.forEach(hero => {
        hero.movement = hero.maxMovement;
      });

      // Process city production
      state.cities.forEach(city => {
        const cityEffects = calculateCityEffects(city);
        Object.keys(cityEffects.totalProduction).forEach(resource => {
          const key = resource as keyof ResourceAmount;
          const production = cityEffects.totalProduction[key] || 0;
          const current = state.resources[key] || 0;
          const storageLimit = state.resourceStorage[key] || 1000;
          state.resources[key] = Math.min(storageLimit, current + production);
        });

        // Update city effects
        state.buildingEffects = {
          enabledFeatures: cityEffects.enabledFeatures,
          totalBonuses: cityEffects.totalBonuses
        };
        state.resourceStorage = cityEffects.totalStorage;
        state.maxPopulation = cityEffects.totalPopulationCapacity;
      });

      // Update building construction
      const now = Date.now();
      state.cities.forEach(city => {
        city.buildings.forEach(building => {
          if (building.constructionStart && building.constructionTime) {
            if (now >= building.constructionStart + building.constructionTime) {
              // Construction completed
              delete building.constructionStart;
              delete building.constructionTime;
              building.isUnderConstruction = false;
              // Apply building effects
              applyBuildingEffects(building.type, building.level, state);
            }
          }

          if (building.isUpgrading && building.upgradeStart && building.upgradeTime) {
            if (now >= building.upgradeStart + building.upgradeTime) {
              // Upgrade completed
              building.isUpgrading = false;
              delete building.upgradeStart;
              delete building.upgradeTime;
              building.isUpgrading = false;
              // Remove old level effects
              applyBuildingEffects(building.type, building.level - 1, state, true);
            }
          }
        });

        // Update available buildings after construction/upgrade completion
        state.availableBuildings = getAvailableBuildings(city, state);
        state.upgradeableBuildings = getUpgradeableBuildings(city, state).map(b => b.id);
      });
    },

    setCameraPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.cameraPosition = action.payload;
    },

    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.zoomLevel = Math.max(0.5, Math.min(2, action.payload));
    },

    toggleGrid: (state) => {
      state.showGrid = !state.showGrid;
    },

    toggleFogOfWar: (state) => {
      state.showFogOfWar = !state.showFogOfWar;
    },

    selectBuildingType: (state, action: PayloadAction<string | null>) => {
      state.selectedBuildingType = action.payload;
    },

    updateBuildingSystem: (state) => {
      // Recalculate all building effects and constraints
      state.cities.forEach(city => {
        const cityEffects = calculateCityEffects(city);
        state.buildingEffects = {
          enabledFeatures: cityEffects.enabledFeatures,
          totalBonuses: cityEffects.totalBonuses
        };
        state.resourceStorage = cityEffects.totalStorage;
        state.maxPopulation = cityEffects.totalPopulationCapacity;
        city.production = cityEffects.totalProduction;

        state.availableBuildings = getAvailableBuildings(city, state);
        state.upgradeableBuildings = getUpgradeableBuildings(city, state).map(b => b.id);
      });

      // Enforce storage limits
      Object.entries(state.resources).forEach(([resource, amount]) => {
        const key = resource as keyof ResourceAmount;
        const storageLimit = state.resourceStorage[key] || 1000;
        if (amount > storageLimit) {
          state.resources[key] = storageLimit;
        }
      });
    },

    updateBuildingTimers: (state) => {
      const now = Date.now();
      let hasUpdates = false;

      state.cities.forEach(city => {
        city.buildings.forEach(building => {
          // Check construction completion
          if (building.constructionStart && building.constructionTime) {
            if (now >= building.constructionStart + building.constructionTime) {
              delete building.constructionStart;
              delete building.constructionTime;
              hasUpdates = true;
            }
          }

          // Check upgrade completion
          if (building.isUpgrading && building.upgradeStart && building.upgradeTime) {
            if (now >= building.upgradeStart + building.upgradeTime) {
              building.isUpgrading = false;
              delete building.upgradeStart;
              delete building.upgradeTime;
              hasUpdates = true;
            }
          }
        });

        // Update available buildings if there were completions
        if (hasUpdates) {
          state.availableBuildings = getAvailableBuildings(city, state);
          state.upgradeableBuildings = getUpgradeableBuildings(city, state).map(b => b.id);

          const cityEffects = calculateCityEffects(city);
          state.buildingEffects = {
            enabledFeatures: cityEffects.enabledFeatures,
            totalBonuses: cityEffects.totalBonuses
          };
          city.production = cityEffects.totalProduction;
          state.resourceStorage = cityEffects.totalStorage;
          state.maxPopulation = cityEffects.totalPopulationCapacity;
        }
      });
    },

    renameCityAction: (state, action: PayloadAction<{ cityId: string; newName: string }>) => {
      const { cityId, newName } = action.payload;
      const city = state.cities.find(c => c.id === cityId);
      if (city && newName.trim()) {
        city.name = newName.trim();
      }
    }
  }
});

export const {
  selectTile,
  selectHero,
  moveHero,
  exploreTile,
  buildStructure,
  upgradeBuilding,
  updateResources,
  nextTurn,
  setCameraPosition,
  setZoomLevel,
  toggleGrid,
  toggleFogOfWar,
  selectBuildingType,
  updateBuildingSystem,
  renameCityAction,
  updateBuildingTimers
} = gameSlice.actions;

export default gameSlice.reducer;

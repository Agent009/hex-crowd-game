import { Coins, Sword, Crown } from "lucide-react";
import { ExtractId } from "../utils/utils";
import { ResourceAmount } from "./gameData.ts";

// Building prerequisites and constraints
export interface BuildingConstraints {
  requiredBuildings?: { [buildingType: string]: number }; // building type -> minimum level
  requiredPopulation?: number;
  requiredCityLevel?: number;
  mutuallyExclusive?: string[]; // Cannot coexist with these buildings
}

export interface BuildingEffects {
  resourceProduction?: ResourceAmount;
  resourceStorage?: ResourceAmount;
  populationIncrease?: number;
  maxPopulationIncrease?: number;
  unlocksBuildings?: string[];
  enablesFeatures?: string[];
  unitCapacityIncrease?: number;
  defenseBonus?: number;
  tradeEfficiency?: number;
  manaRegeneration?: number;
  recruitmentSpeedBonus?: number;
  unitUpgradeBonus?: number;
}

export interface BuildingData {
  id: string;
  name: string;
  category: BuildingCategoryType;
  description: string;
  strategicImportance?: string;
  factionVariations?: { [faction: string]: string };
  maxLevel: number; // Maximum upgrade level
  levels: BuildingLevel[];
}

export interface BuildingLevel {
  // Metadata
  level: number;
  benefits: string[];
  // Costs and build/upgrade requirements
  apCost: number;
  buildTime: number; // in minutes
  constraints: BuildingConstraints;
  resourcesCost: ResourceAmount;
  // Benefits and effects
  effects: BuildingEffects;
}

export const buildingCategories = {
  Military: { icon: Sword, color: '#DC2626' },
  Resource: { icon: Coins, color: '#059669' },
  Support: { icon: Crown, color: '#7C3AED' }
};

export type BuildingCategoryType = keyof typeof buildingCategories;

// Centralized building database
export const buildingDatabase: BuildingData[] = [
  {
    id: 'town_hall',
    name: 'Town Hall',
    category: 'Support',
    description: 'The administrative heart of your settlement, governing population and unlocking advanced structures.',
    strategicImportance: 'Essential foundation building that determines city growth potential and unlocks all other structures.',
    factionVariations: {
      haven: 'Castle Keep - Enhanced defensive capabilities',
      necropolis: 'Necropolis Hall - Generates undead population',
      inferno: 'Demon Gate - Summons demonic workers'
    },
    maxLevel: 5,
    levels: [
      {
        level: 1,
        apCost: 2,
        buildTime: 1,
        constraints: {
          requiredBuildings: {}
        },
        resourcesCost: { gold: 500, wood: 20 },
        benefits: ['Unlocks basic buildings', 'Population limit: 100', 'Storage: 1000 each resource'],
        effects: {
          maxPopulationIncrease: 100,
          resourceStorage: { gold: 1000, wood: 1000, ore: 1000, gems: 1000, crystal: 1000 },
          resourceProduction: { gold: 500 },
          unlocksBuildings: ['barracks', 'mine', 'marketplace']
        }
      },
      {
        level: 2,
        apCost: 3,
        buildTime: 5,
        constraints: {
          requiredBuildings: {
            barracks: 1
          }
        },
        resourcesCost: { gold: 1000, wood: 40, ore: 10 },
        benefits: ['Population limit: 250', 'Storage: 2500 each resource', 'Unlocks Marketplace'],
        effects: {
          maxPopulationIncrease: 250,
          resourceStorage: { gold: 2500, wood: 2500, ore: 2500, gems: 2500, crystal: 2500 },
          resourceProduction: { gold: 750 },
          unlocksBuildings: ['archery_range']
        }
      },
      {
        level: 3,
        apCost: 4,
        buildTime: 10,
        constraints: {
          requiredBuildings: {
            marketplace: 1,
            archery_range: 1
          }
        },
        resourcesCost: { gold: 2000, wood: 80, ore: 25, gems: 5 },
        benefits: ['Population limit: 500', 'Storage: 5000 each resource', 'Unlocks Mage Guild'],
        effects: {
          maxPopulationIncrease: 500,
          resourceStorage: { gold: 5000, wood: 5000, ore: 5000, gems: 5000, crystal: 5000 },
          resourceProduction: { gold: 1000 },
          unlocksBuildings: ['mage_guild']
        }
      },
      {
        level: 4,
        apCost: 6,
        buildTime: 15,
        constraints: {
          requiredBuildings: {
            mage_guild: 2,
            blacksmith: 2
          }
        },
        resourcesCost: { gold: 4000, wood: 160, ore: 50, gems: 15, crystal: 5 },
        benefits: ['Population limit: 1000', 'Storage: 10000 each resource', 'Unlocks advanced military'],
        effects: {
          maxPopulationIncrease: 1000,
          resourceStorage: { gold: 10000, wood: 10000, ore: 10000, gems: 10000, crystal: 10000 },
          resourceProduction: { gold: 1500 },
          enablesFeatures: ['advanced_military']
        }
      },
      {
        level: 5,
        apCost: 8,
        buildTime: 20,
        constraints: {
          requiredBuildings: {
            mage_guild: 3,
            blacksmith: 3
          }
        },
        resourcesCost: { gold: 8000, wood: 320, ore: 100, gems: 30, crystal: 15 },
        benefits: ['Population limit: 2000', 'Storage: 20000 each resource', 'Unlocks legendary units'],
        effects: {
          maxPopulationIncrease: 2000,
          resourceStorage: { gold: 20000, wood: 20000, ore: 20000, gems: 20000, crystal: 20000 },
          resourceProduction: { gold: 2000 },
          enablesFeatures: ['legendary_units']
        }
      }
    ]
  },
  {
    id: 'archery_range',
    name: 'Archery Range',
    category: 'Military',
    description: 'Train ranged units',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        apCost: 3,
        buildTime: 5,
        constraints: {
          requiredBuildings: { barracks: 1, town_hall: 2 }
        },
        resourcesCost: { gold: 500, wood: 25 },
        benefits: ['Tier 1-2 Ranged Units'],
        effects: {
          enablesFeatures: ['ranged_units_tier_1_2']
        }
      },
      {
        level: 2,
        apCost: 4,
        buildTime: 10,
        constraints: {
          requiredBuildings: { mine: 2 }
        },
        resourcesCost: { gold: 1000, wood: 50 },
        benefits: ['Tier 1-3 Ranged Units'],
        effects: {
          enablesFeatures: ['ranged_units_tier_1_3']
        }
      },
      {
        level: 3,
        apCost: 6,
        buildTime: 15,
        constraints: {
          requiredBuildings: { mage_guild: 1 }
        },
        resourcesCost: { gold: 2000, wood: 100 },
        benefits: ['Tier 1-4 Ranged Units'],
        effects: {
          enablesFeatures: ['ranged_units_tier_1_4']
        }
      },
    ]
  },
  {
    id: 'barracks',
    name: 'Barracks',
    category: 'Military',
    description: 'Training facility for basic infantry units and military recruitment.',
    strategicImportance: 'Core military building enabling army recruitment and unit upgrades.',
    factionVariations: {
      haven: 'Guardian Barracks - Trains holy warriors',
      necropolis: 'Bone Yard - Raises undead soldiers',
      inferno: 'Demon Pit - Summons demonic troops'
    },
    maxLevel: 4,
    levels: [
      {
        level: 1,
        apCost: 2,
        buildTime: 5,
        constraints: {
          requiredBuildings: { town_hall: 1 }
        },
        resourcesCost: { gold: 300, wood: 15 },
        benefits: ['Trains Tier 1-2 units', 'Unit capacity: 50', 'Recruitment speed: Normal'],
        effects: {
          unitCapacityIncrease: 50,
          enablesFeatures: ['tier_1_2_units']
        }
      },
      {
        level: 2,
        apCost: 3,
        buildTime: 10,
        constraints: {
          requiredBuildings: { town_hall: 2 }
        },
        resourcesCost: { gold: 600, wood: 30, ore: 10 },
        benefits: ['Trains Tier 1-3 units', 'Unit capacity: 100', 'Recruitment speed: +25%'],
        effects: {
          unitCapacityIncrease: 100,
          recruitmentSpeedBonus: 25,
          enablesFeatures: ['tier_1_3_units']
        }
      },
      {
        level: 3,
        apCost: 4,
        buildTime: 15,
        constraints: {
          requiredBuildings: { blacksmith: 1 }
        },
        resourcesCost: { gold: 1200, wood: 60, ore: 25, gems: 5 },
        benefits: ['Trains Tier 1-4 units', 'Unit capacity: 200', 'Recruitment speed: +50%'],
        effects: {
          unitCapacityIncrease: 200,
          recruitmentSpeedBonus: 50,
          enablesFeatures: ['tier_1_4_units']
        }
      },
      {
        level: 4,
        apCost: 6,
        buildTime: 120,
        constraints: {
          requiredBuildings: { mage_guild: 1 }
        },
        resourcesCost: { gold: 2400, wood: 120, ore: 50, gems: 15 },
        benefits: ['Trains all unit tiers', 'Unit capacity: 400', 'Recruitment speed: +100%'],
        effects: {
          unitCapacityIncrease: 400,
          recruitmentSpeedBonus: 100,
          enablesFeatures: ['all_unit_tiers']
        }
      }
    ]
  },
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    category: 'Support',
    description: 'Forge for creating and upgrading weapons, armor, and military equipment.',
    strategicImportance: 'Essential for unit upgrades and equipment enhancement.',
    maxLevel: 4,
    levels: [
      {
        level: 1,
        apCost: 2,
        buildTime: 5,
        constraints: {
          requiredBuildings: { barracks: 1 }
        },
        resourcesCost: { gold: 500, wood: 20, ore: 10 },
        benefits: ['Basic Equipment Upgrades'],
        effects: {
          unitUpgradeBonus: 10,
          enablesFeatures: ['basic_equipment']
        }
      },
      {
        level: 2,
        apCost: 3,
        buildTime: 10,
        constraints: {
          requiredBuildings: { mine: 2 }
        },
        resourcesCost: { gold: 1000, wood: 40, ore: 25 },
        benefits: ['Advanced Equipment Upgrades'],
        effects: {
          unitUpgradeBonus: 25,
          enablesFeatures: ['advanced_equipment']
        }
      },
      {
        level: 3,
        apCost: 4,
        buildTime: 15,
        constraints: {
          requiredBuildings: { mage_guild: 1 }
        },
        resourcesCost: { gold: 2000, wood: 80, ore: 50, gems: 10 },
        benefits: ['Magical Equipment Upgrades'],
        effects: {
          unitUpgradeBonus: 50,
          enablesFeatures: ['magical_enhancement']
        }
      },
      {
        level: 4,
        apCost: 6,
        buildTime: 20,
        constraints: {
          requiredBuildings: { barracks: 1 }
        },
        resourcesCost: { gold: 4000, wood: 160, ore: 100, gems: 25, crystal: 10 },
        benefits: ['Legendary Equipment Upgrades', 'Artifact Creation'],
        effects: {
          unitUpgradeBonus: 100,
          enablesFeatures: ['legendary_equipment', 'artifact_creation']
        }
      },
    ]
  },
  {
    id: 'mage_guild',
    name: 'Mage Guild',
    category: 'Support',
    description: 'Research spells and train magical units',
    strategicImportance: 'Unlocks spell casting, magical research, and enhances hero capabilities.',
    factionVariations: {
      haven: 'Cathedral of Light - Holy magic specialization',
      necropolis: 'Necromancy Academy - Death magic focus',
      inferno: 'Demon Academy - Chaos magic mastery'
    },
    maxLevel: 5,
    levels: [
      {
        level: 1,
        apCost: 3,
        buildTime: 5,
        constraints: {
          requiredBuildings: { town_hall: 3 }
        },
        resourcesCost: { gold: 800, wood: 25, gems: 5 },
        benefits: ['Level 1-2 spells', 'Spell research: Basic', 'Mana regeneration: +2/turn'],
        effects: {
          manaRegeneration: 2,
          enablesFeatures: ['level_1_2_spells', 'basic_research']
        }
      },
      {
        level: 2,
        apCost: 4,
        constraints: {},
        buildTime: 10,
        resourcesCost: { gold: 1600, wood: 50, gems: 15, crystal: 5 },
        benefits: ['Level 1-3 spells', 'Spell research: Intermediate', 'Mana regeneration: +4/turn'],
        effects: {
          manaRegeneration: 4,
          enablesFeatures: ['level_1_3_spells', 'intermediate_research']
        }
      },
      {
        level: 3,
        apCost: 5,
        buildTime: 15,
        constraints: {},
        resourcesCost: { gold: 3200, wood: 100, gems: 30, crystal: 15 },
        benefits: ['Level 1-4 spells', 'Spell research: Advanced', 'Mana regeneration: +6/turn'],
        effects: {
          manaRegeneration: 6,
          enablesFeatures: ['level_1_4_spells', 'advanced_research']
        }
      },
      {
        level: 4,
        apCost: 7,
        buildTime: 20,
        constraints: {},
        resourcesCost: { gold: 6400, wood: 200, gems: 60, crystal: 30 },
        benefits: ['Level 1-5 spells', 'Spell research: Expert', 'Mana regeneration: +8/turn'],
        effects: {
          manaRegeneration: 8,
          enablesFeatures: ['level_1_5_spells', 'expert_research']
        }
      },
      {
        level: 5,
        apCost: 10,
        buildTime: 25,
        constraints: {},
        resourcesCost: { gold: 12800, wood: 400, gems: 120, crystal: 60 },
        benefits: ['All spell levels', 'Spell research: Master', 'Mana regeneration: +12/turn'],
        effects: {
          manaRegeneration: 12,
          enablesFeatures: ['all_spell_levels', 'master_research']
        }
      }
    ]
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    category: 'Resource',
    description: 'Trading hub that enables resource exchange and generates additional income.',
    strategicImportance: 'Enables resource trading and provides economic flexibility.',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        apCost: 2,
        buildTime: 5,
        constraints: {
          requiredBuildings: { town_hall: 2 }
        },
        resourcesCost: { gold: 600, wood: 30 },
        benefits: ['Resource trading enabled', 'Trade efficiency: 100%', 'Daily trade limit: 1000'],
        effects: {
          resourceProduction: { gold: 200 },
          tradeEfficiency: 100,
          enablesFeatures: ['resource_trading']
        }
      },
      {
        level: 2,
        apCost: 3,
        buildTime: 10,
        constraints: {
          requiredBuildings: { mine: 2 }
        },
        resourcesCost: { gold: 1200, wood: 60, ore: 10 },
        benefits: ['Trade efficiency: 150%', 'Daily trade limit: 2500', 'Caravan routes'],
        effects: {
          resourceProduction: { gold: 400 },
          tradeEfficiency: 150,
          enablesFeatures: ['caravan_routes']
        }
      },
      {
        level: 3,
        apCost: 4,
        buildTime: 15,
        constraints: {
          requiredBuildings: { mage_guild: 1 }
        },
        resourcesCost: { gold: 2400, wood: 120, ore: 25, gems: 5 },
        benefits: ['Trade efficiency: 200%', 'Daily trade limit: 5000', 'International trade'],
        effects: {
          resourceProduction: { gold: 800 },
          tradeEfficiency: 200,
          enablesFeatures: ['international_trade']
        }
      },
    ]
  },
  {
    id: 'mine',
    name: 'Mine',
    category: 'Resource',
    description: 'Extracts precious metals and gems from the earth, providing steady income.',
    strategicImportance: 'Primary source of gold and rare materials essential for advanced construction.',
    maxLevel: 5,
    levels: [
      {
        level: 1,
        apCost: 2,
        buildTime: 1,
        constraints: {
          requiredBuildings: { town_hall: 1 }
        },
        resourcesCost: { gold: 400, wood: 10 },
        benefits: ['Generates gold and ore', '+300 Gold/turn', '+5 Ore/turn'],
        effects: {
          resourceProduction: { gold: 300, ore: 5 }
        }
      },
      {
        level: 2,
        apCost: 3,
        buildTime: 5,
        constraints: {},
        resourcesCost: { gold: 800, wood: 20, ore: 5 },
        benefits: ['Unlocks gem extraction', '+450 Gold/turn', '+8 Ore/turn', '+1 Gems/turn'],
        effects: {
          resourceProduction: { gold: 450, ore: 8, gems: 1 }
        }
      },
      {
        level: 3,
        apCost: 4,
        buildTime: 10,
        constraints: {
          requiredBuildings: { blacksmith: 1 }
        },
        resourcesCost: { gold: 1600, wood: 40, ore: 15 },
        benefits: ['Deep mining unlocked', '+600 Gold/turn', '+12 Ore/turn', '+2 Gems/turn'],
        effects: {
          resourceProduction: { gold: 600, ore: 12, gems: 2 }
        }
      },
      {
        level: 4,
        apCost: 5,
        buildTime: 15,
        constraints: {},
        resourcesCost: { gold: 3200, wood: 80, ore: 30, gems: 5 },
        benefits: ['Crystal extraction', '+900 Gold/turn', '+18 Ore/turn', '+4 Gems/turn', '+1 Crystal/turn'],
        effects: {
          resourceProduction: { gold: 900, ore: 18, gems: 4, crystal: 1 }
        }
      },
      {
        level: 5,
        apCost: 7,
        buildTime: 20,
        constraints: {},
        resourcesCost: { gold: 6400, wood: 160, ore: 60, gems: 15, crystal: 5 },
        benefits: ['Rare material synthesis', '+1500 Gold/turn', '+30 Ore/turn', '+8 Gems/turn', '+3 Crystals/turn'],
        effects: {
          resourceProduction: { gold: 1500, ore: 30, gems: 8, crystal: 3 }
        }
      }
    ]
  },
] as const;

export type BuildingType = ExtractId<(typeof buildingDatabase)[number]>;

// Helper function to get building data by ID
export function getBuildingById(id: string): BuildingData | undefined {
  return buildingDatabase.find(building => building.id === id);
}

// Helper function to get building level data
export function getBuildingLevelData(buildingId: BuildingType, level: number = 1): BuildingLevel | undefined {
  const building = getBuildingById(buildingId);
  if (!building) return undefined;
  
  return building.levels.find(l => l.level === level);
}

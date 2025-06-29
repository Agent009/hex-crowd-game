// Game data configuration
import { Coins, Gem, Mountain, Trees, Zap } from "lucide-react";
import { BuildingData, buildingDatabase, BuildingType } from "./buildingsData.ts";

export interface FactionData {
  id: string;
  name: string;
  description: string;
  color: string;
  units: UnitData[];
  buildings: BuildingType[];
  heroes: HeroData[];
}

export interface UnitData {
  id: string;
  name: string;
  tier: number;
  cost: ResourceAmount;
  stats: UnitStats;
  abilities?: string[];
}

export interface UnitStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  damage: [number, number]; // min, max damage
}

export interface HeroData {
  id: string;
  name: string;
  faction: string;
  class: string;
  startingStats: HeroStats;
  skills: SkillData[];
}

export interface HeroStats {
  attack: number;
  defense: number;
  spellPower: number;
  knowledge: number;
  movement: number;
}

export interface SkillData {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
}

// Faction data
export const factions: FactionData[] = [
  {
    id: 'haven',
    name: 'Haven',
    description: 'The righteous kingdom of light and order',
    color: '#4A90E2',
    units: [
      {
        id: 'peasant',
        name: 'Peasant',
        tier: 1,
        cost: { gold: 15 },
        stats: { hp: 4, attack: 1, defense: 1, speed: 3, damage: [1, 1] }
      },
      {
        id: 'archer',
        name: 'Archer',
        tier: 2,
        cost: { gold: 150, wood: 5 },
        stats: { hp: 10, attack: 6, defense: 3, speed: 4, damage: [2, 3] }
      },
      {
        id: 'griffin',
        name: 'Griffin',
        tier: 3,
        cost: { gold: 300 },
        stats: { hp: 25, attack: 8, defense: 8, speed: 6, damage: [3, 6] },
        abilities: ['flying']
      },
      {
        id: 'swordsman',
        name: 'Swordsman',
        tier: 4,
        cost: { gold: 500, ore: 2 },
        stats: { hp: 35, attack: 10, defense: 12, speed: 5, damage: [6, 9] }
      },
      {
        id: 'monk',
        name: 'Monk',
        tier: 5,
        cost: { gold: 750, gems: 2 },
        stats: { hp: 30, attack: 12, defense: 7, speed: 5, damage: [10, 12] },
        abilities: ['ranged', 'no_melee_penalty']
      },
      {
        id: 'paladin',
        name: 'Paladin',
        tier: 6,
        cost: { gold: 2000, ore: 5, gems: 2 },
        stats: { hp: 180, attack: 18, defense: 18, speed: 5, damage: [18, 23] },
        abilities: ['spell_immunity']
      }
    ],
    buildings: ['town_hall', 'barracks', 'archery_range', 'mine', 'marketplace', 'blacksmith', 'mage_guild'],
    heroes: [
      {
        id: 'roland',
        name: 'Roland',
        faction: 'haven',
        class: 'Knight',
        startingStats: { attack: 2, defense: 2, spellPower: 1, knowledge: 1, movement: 1560 },
        skills: []
      }
    ]
  },
  {
    id: 'necropolis',
    name: 'Necropolis',
    description: 'The undead realm of darkness and death',
    color: '#8B4A9C',
    units: [
      {
        id: 'skeleton',
        name: 'Skeleton',
        tier: 1,
        cost: { gold: 20 },
        stats: { hp: 5, attack: 2, defense: 1, speed: 3, damage: [1, 2] }
      },
      {
        id: 'zombie',
        name: 'Zombie',
        tier: 2,
        cost: { gold: 125 },
        stats: { hp: 15, attack: 5, defense: 2, speed: 2, damage: [2, 3] },
        abilities: ['disease']
      },
      {
        id: 'wight',
        name: 'Wight',
        tier: 3,
        cost: { gold: 250 },
        stats: { hp: 18, attack: 7, defense: 7, speed: 5, damage: [3, 5] },
        abilities: ['drain_life']
      },
      {
        id: 'vampire',
        name: 'Vampire',
        tier: 4,
        cost: { gold: 500, gems: 1 },
        stats: { hp: 30, attack: 10, defense: 9, speed: 6, damage: [5, 8] },
        abilities: ['flying', 'no_retaliation']
      },
      {
        id: 'lich',
        name: 'Lich',
        tier: 5,
        cost: { gold: 750, gems: 3 },
        stats: { hp: 25, attack: 13, defense: 10, speed: 6, damage: [11, 15] },
        abilities: ['ranged', 'death_cloud']
      },
      {
        id: 'bone_dragon',
        name: 'Bone Dragon',
        tier: 6,
        cost: { gold: 3000, gems: 5, crystal: 2 },
        stats: { hp: 180, attack: 17, defense: 15, speed: 6, damage: [25, 50] },
        abilities: ['flying', 'fear', 'aging']
      }
    ],
    buildings: ['town_hall', 'barracks', 'archery_range', 'mine', 'marketplace', 'blacksmith', 'mage_guild'],
    heroes: [
      {
        id: 'thant',
        name: 'Thant',
        faction: 'necropolis',
        class: 'Necromancer',
        startingStats: { attack: 1, defense: 1, spellPower: 2, knowledge: 2, movement: 1500 },
        skills: []
      }
    ]
  }
];

export function getFactionBuildings(factionId: string): BuildingData[] {
  const faction = factions.find(f => f.id === factionId);
  if (!faction) return [];

  return faction.buildings
    .map(buildingId => buildingDatabase.find(b => b.id === buildingId))
    .filter((building): building is BuildingData => building !== undefined);
}

export type TerrainType = "grass" | "forest" | "mountain" | "water" | "desert" | "swamp";
export interface TerrainTypeData {
  name: string;
  moveCost: number;
  defenseBonus: number;
  color: string;
}

export type TerrainData = Record<TerrainType, TerrainTypeData>;

// Terrain data
export const terrainData: TerrainData = {
  grass: {
    name: 'Grassland',
    moveCost: 1,
    defenseBonus: 0,
    color: '#7CB342'
  },
  forest: {
    name: 'Forest',
    moveCost: 2,
    defenseBonus: 1,
    color: '#388E3C'
  },
  mountain: {
    name: 'Mountain',
    moveCost: 3,
    defenseBonus: 2,
    color: '#6D4C41'
  },
  water: {
    name: 'Water',
    moveCost: 999, // Cannot move through without special ability
    defenseBonus: 0,
    color: '#1976D2'
  },
  desert: {
    name: 'Desert',
    moveCost: 2,
    defenseBonus: 0,
    color: '#FFB74D'
  },
  swamp: {
    name: 'Swamp',
    moveCost: 3,
    defenseBonus: -1,
    color: '#689F38'
  }
};

// Resource icons and data
export const resourceData = {
  gold: { name: 'Gold', color: '#FFD700', icon: Coins, emoji: '💰' },
  wood: { name: 'Wood', color: '#8D6E63', icon: Trees, emoji: '🌲' },
  ore: { name: 'Ore', color: '#607D8B', icon: Mountain, emoji: '⛏️️' },
  gems: { name: 'Gems', color: '#E91E63', icon: Gem, emoji: '💎' },
  crystal: { name: 'Crystal', color: '#9C27B0', icon: Zap, emoji: '✨' }
};

export type ResourceType = keyof typeof resourceData;
export type ResourceAmount = {
  [K in ResourceType]?: number;
};

export const gameSize: number = import.meta.env.VITE_GRID_SIZE ? import.meta.env.VITE_GRID_SIZE as number : 15;

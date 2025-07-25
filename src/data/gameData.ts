// Game data configuration for party game format
import { Droplets, Waves, Mountain, Flag, Diamond, Trees } from "lucide-react";
import { BuildingData, buildingDatabase, BuildingType } from "./buildingsData.ts";
import { CubeCoords } from "../utils/hexGrid";

// Player data for party game
export interface Player {
  id: string;
  name: string;
  number: number; // 1-30
  teamId: string;
  color: string;
  position: CubeCoords;
  isReady: boolean;
  isConnected: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
  score: number;
}

export type StatType = "AP" | "HP" | "Score";
export type EffectType = "Gain" | "Loss";
export type EffectOccurrenceType = "OneOff" | "PerRound";

export interface StatEffectData {
  stat: StatType; // The stat to effect
  type: EffectType; // The type of effect (Gain or Loss)
  occurrence: EffectOccurrenceType; // The frequency of effect occurrence
  chance: number; // Chance of effect occurring
  min: number; // Minimum effect value
  max: number; // Maximum effect value
}

// Faction data (simplified for party game)
export const factions: FactionData[] = [
  {
    id: 'haven',
    name: 'Haven',
    description: 'The righteous kingdom of light and order',
    color: '#4A90E2',
    units: [],
    buildings: [],
    heroes: []
  }
];

export type TerrainType = "lake" | "river" | "mountain" | "desert" | "plains" | "forest";
export interface TerrainTypeData {
  name: string;
  moveCost: number;
  defenseBonus: number;
  color: string;
  icon: any;
  requiredItem?: string; // Item required to move to this tile
  alternativeAPCost?: number; // Extra AP cost if no required item
  effects?: {
    hpLossPerRound?: number;
    hpGainPerRound?: Record<string, StatEffectData>[]; // HP loss per round, keyed by resource type;
    protectionItem?: string; // Item that prevents HP loss
    protectionResource?: string; // Resource that prevents HP loss
    itemChance?: number; // Chance to find items
    alwaysActive?: boolean; // Tile remains active for harvesting
  };
  disasters?: string[]; // Disasters this terrain is vulnerable to
}

export type TerrainData = Record<TerrainType, TerrainTypeData>;

// Updated terrain data to match reference board
export const terrainData: TerrainData = {
  lake: {
    name: 'Lake',
    moveCost: 2,
    defenseBonus: 0,
    color: '#1976D2',
    icon: Droplets,
    requiredItem: 'boat',
    alternativeAPCost: 2, // 1 base + 1 extra = 2 total
    effects: {
      alwaysActive: true
    },
    disasters: ['storm']
  },
  river: {
    name: 'River',
    moveCost: 1,
    defenseBonus: 0,
    color: '#2196F3',
    icon: Waves,
    requiredItem: 'boat',
    alternativeAPCost: 2, // 1 base + 1 extra = 2 total
    effects: {
      hpLossPerRound: 2,
      protectionItem: 'boat'
    },
    disasters: ['tsunami']
  },
  mountain: {
    name: 'Mountain',
    moveCost: 2,
    defenseBonus: 2,
    color: '#6D4C41',
    icon: Mountain,
    requiredItem: 'climbing_gear',
    alternativeAPCost: 3, // 2 base + 1 extra = 3 total
    effects: {
      itemChance: 25
    },
    disasters: ['earthquake']
  },
  desert: {
    name: 'Desert',
    moveCost: 1,
    defenseBonus: 0,
    color: '#FFB74D',
    icon: Flag,
    effects: {
      hpLossPerRound: 2,
      protectionResource: 'water'
    },
    disasters: ['sandstorm']
  },
  plains: {
    name: 'Plains',
    moveCost: 1,
    defenseBonus: 0,
    color: '#4DB6AC',
    icon: Diamond,
    effects: {
      hpGainPerRound: [{
        "sunfire": {
          stat: "HP",
          type: "Gain",
          occurrence: "PerRound",
          chance: 25,
          min: 1,
          max: 1,
        }
      }],
    },
    disasters: ['earthquake', 'sandstorm']
  },
  forest: {
    name: 'Forest',
    moveCost: 2,
    defenseBonus: 1,
    color: '#388E3C',
    icon: Trees,
    effects: {
      hpLossPerRound: 2,
      protectionItem: 'camping_gear'
    },
    disasters: ['wildfire']
  }
};

// Disaster definitions
export interface DisasterData {
  id: string;
  name: string;
  effects: { [terrain: string]: number }; // HP damage per terrain
  animation?: string;
  color: string;
}

export const disasterData: { [key: string]: DisasterData } = {
  earthquake: {
    id: 'earthquake',
    name: 'Earthquake',
    effects: {
      plains: -3,
      desert: -3,
      forest: -3,
      mountain: -3,
      river: 0,
      lake: 0
    },
    animation: 'shake',
    color: '#8B4513'
  },
  sandstorm: {
    id: 'sandstorm',
    name: 'Sandstorm',
    effects: {
      plains: -2,
      desert: -3,
      forest: 0,
      mountain: 0,
      river: 0,
      lake: 0
    },
    animation: 'dust',
    color: '#DEB887'
  },
  wildfire: {
    id: 'wildfire',
    name: 'Wildfire',
    effects: {
      plains: -2,
      desert: 0,
      forest: -3,
      mountain: 0,
      river: 0,
      lake: 0
    },
    animation: 'fire',
    color: '#FF4500'
  },
  tsunami: {
    id: 'tsunami',
    name: 'Tsunami',
    effects: {
      plains: -3,
      desert: 0,
      forest: -2,
      mountain: 0,
      river: -1,
      lake: -1
    },
    animation: 'wave',
    color: '#4682B4'
  },
  storm: {
    id: 'storm',
    name: 'Storm',
    effects: {
      plains: 0,
      desert: 0,
      forest: 0,
      mountain: 0,
      river: 0,
      lake: -2 // Special: destroys boats
    },
    animation: 'lightning',
    color: '#483D8B'
  }
};
// Resource icons and data (simplified for party game)
export const resourceData = {
  gold: { name: 'Gold', color: '#FFD700', icon: Diamond, emoji: '💰' },
  wood: { name: 'Wood', color: '#8D6E63', icon: Trees, emoji: '🌲' },
  ore: { name: 'Ore', color: '#607D8B', icon: Mountain, emoji: '⛏️️' },
  gems: { name: 'Gems', color: '#E91E63', icon: Diamond, emoji: '💎' },
  crystal: { name: 'Crystal', color: '#9C27B0', icon: Diamond, emoji: '✨' }
};

export type ResourceType = keyof typeof resourceData;
export type ResourceAmount = {
  [K in ResourceType]?: number;
};

// Game configuration for party mode - configurable via environment variables
export const gameSize: number = 5; // Creates 91 hex tiles total
export const maxPlayers: number = 30;
export const requiredTeams: number = import.meta.env.VITE_REQUIRED_TEAMS ? parseInt(import.meta.env.VITE_REQUIRED_TEAMS) : 10;
export const requiredPlayersPerTeam: number = import.meta.env.VITE_REQUIRED_PLAYERS_PER_TEAM ? parseInt(import.meta.env.VITE_REQUIRED_PLAYERS_PER_TEAM) : 3;
export const maxTeams: number = requiredTeams;
export const playersPerTeam: number = requiredPlayersPerTeam;
export const isTestMode: boolean = import.meta.env.VITE_TEST_MODE === 'true';

// Predefined terrain layout matching the reference board
export const predefinedTerrain: { [key: string]: TerrainType } = {
  // Center tile (lake)
  "0,0,0": "lake",
  
  // Ring 1 (6 tiles) - rivers and mountains
  "1,-1,0": "river",
  "1,0,-1": "river", 
  "0,1,-1": "river",
  "-1,1,0": "river",
  "-1,0,1": "river",
  "0,-1,1": "river",
  
  // Ring 2 (12 tiles) - mixed terrain
  "2,-2,0": "mountain",
  "2,-1,-1": "mountain",
  "2,0,-2": "river",
  "1,1,-2": "mountain",
  "0,2,-2": "mountain",
  "-1,2,-1": "mountain",
  "-2,2,0": "mountain",
  "-2,1,1": "mountain",
  "-2,0,2": "river",
  "-1,-1,2": "mountain",
  "0,-2,2": "mountain",
  "1,-2,1": "mountain",
  
  // Ring 3 (18 tiles) - more varied terrain
  "3,-3,0": "forest",
  "3,-2,-1": "forest",
  "3,-1,-2": "forest",
  "3,0,-3": "mountain",
  "2,1,-3": "forest",
  "1,2,-3": "forest",
  "0,3,-3": "forest",
  "-1,3,-2": "river",
  "-2,3,-1": "river",
  "-3,3,0": "forest",
  "-3,2,1": "forest",
  "-3,1,2": "forest",
  "-3,0,3": "mountain",
  "-2,-1,3": "forest",
  "-1,-2,3": "forest",
  "0,-3,3": "forest",
  "1,-3,2": "river",
  "2,-3,1": "river",
  
  // Ring 4 (24 tiles) - outer terrain
  "4,-4,0": "plains",
  "4,-3,-1": "plains",
  "4,-2,-2": "plains",
  "4,-1,-3": "plains",
  "4,0,-4": "desert",
  "3,1,-4": "desert",
  "2,2,-4": "desert",
  "1,3,-4": "desert",
  "0,4,-4": "desert",
  "-1,4,-3": "forest",
  "-2,4,-2": "forest",
  "-3,4,-1": "forest",
  "-4,4,0": "plains",
  "-4,3,1": "plains",
  "-4,2,2": "plains",
  "-4,1,3": "plains",
  "-4,0,4": "desert",
  "-3,-1,4": "desert",
  "-2,-2,4": "desert",
  "-1,-3,4": "desert",
  "0,-4,4": "desert",
  "1,-4,3": "forest",
  "2,-4,2": "forest",
  "3,-4,1": "forest",
  
  // Ring 5 (30 tiles) - outermost ring for player starting positions
  "5,-5,0": "plains",
  "5,-4,-1": "plains",
  "5,-3,-2": "plains",
  "5,-2,-3": "plains",
  "5,-1,-4": "plains",
  "5,0,-5": "plains",
  "4,1,-5": "plains",
  "3,2,-5": "plains",
  "2,3,-5": "plains",
  "1,4,-5": "plains",
  "0,5,-5": "plains",
  "-1,5,-4": "plains",
  "-2,5,-3": "plains",
  "-3,5,-2": "plains",
  "-4,5,-1": "plains",
  "-5,5,0": "plains",
  "-5,4,1": "plains",
  "-5,3,2": "plains",
  "-5,2,3": "plains",
  "-5,1,4": "plains",
  "-5,0,5": "plains",
  "-4,-1,5": "plains",
  "-3,-2,5": "plains",
  "-2,-3,5": "plains",
  "-1,-4,5": "plains",
  "0,-5,5": "plains",
  "1,-5,4": "plains",
  "2,-5,3": "plains",
  "3,-5,2": "plains",
  "4,-5,1": "plains"
};

// Player starting positions (outer ring coordinates)
export const playerStartingPositions: CubeCoords[] = [
  { q: 5, r: -5, s: 0 },   // Position 1
  { q: 5, r: -4, s: -1 },  // Position 2
  { q: 5, r: -3, s: -2 },  // Position 3
  { q: 5, r: -2, s: -3 },  // Position 4
  { q: 5, r: -1, s: -4 },  // Position 5
  { q: 5, r: 0, s: -5 },   // Position 6
  { q: 4, r: 1, s: -5 },   // Position 7
  { q: 3, r: 2, s: -5 },   // Position 8
  { q: 2, r: 3, s: -5 },   // Position 9
  { q: 1, r: 4, s: -5 },   // Position 10
  { q: 0, r: 5, s: -5 },   // Position 11
  { q: -1, r: 5, s: -4 },  // Position 12
  { q: -2, r: 5, s: -3 },  // Position 13
  { q: -3, r: 5, s: -2 },  // Position 14
  { q: -4, r: 5, s: -1 },  // Position 15
  { q: -5, r: 5, s: 0 },   // Position 16
  { q: -5, r: 4, s: 1 },   // Position 17
  { q: -5, r: 3, s: 2 },   // Position 18
  { q: -5, r: 2, s: 3 },   // Position 19
  { q: -5, r: 1, s: 4 },   // Position 20
  { q: -5, r: 0, s: 5 },   // Position 21
  { q: -4, r: -1, s: 5 },  // Position 22
  { q: -3, r: -2, s: 5 },  // Position 23
  { q: -2, r: -3, s: 5 },  // Position 24
  { q: -1, r: -4, s: 5 },  // Position 25
  { q: 0, r: -5, s: 5 },   // Position 26
  { q: 1, r: -5, s: 4 },   // Position 27
  { q: 2, r: -5, s: 3 },   // Position 28
  { q: 3, r: -5, s: 2 },   // Position 29
  { q: 4, r: -5, s: 1 }    // Position 30
];

// Team colors
export const teamColors = [
  '#FF5722', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0',
  '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5'
];

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

export function getFactionBuildings(factionId: string): BuildingData[] {
  const faction = factions.find(f => f.id === factionId);
  if (!faction) return [];

  return faction.buildings
    .map(buildingId => buildingDatabase.find(b => b.id === buildingId))
    .filter((building): building is BuildingData => building !== undefined);
}
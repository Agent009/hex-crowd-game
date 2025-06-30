import { TerrainType } from './gameData';

// Resource definitions
export interface ResourceData {
  id: string;
  name: string;
  value: number; // Coin value
  quantity: number; // Total available in game
  terrainDistribution: { [key in TerrainType]: number }; // Percentage chance on each terrain
}

// Item definitions
export interface ItemData {
  id: string;
  name: string;
  minUses: number;
  maxUses: number;
  quantity: number; // Total available in game
  craftingRequirements: { [resourceId: string]: number };
  effects: string[];
}

// Harvest grid slot
export interface HarvestSlot {
  id: string;
  terrainType: TerrainType;
  items: (ResourceData | ItemData)[];
}

// Resource database
export const resourceDatabase: ResourceData[] = [
  {
    id: 'cloth',
    name: 'Cloth',
    value: 1,
    quantity: 20,
    terrainDistribution: {
      plains: 25,
      desert: 1,
      forest: 10,
      mountain: 1,
      river: 0,
      lake: 0
    }
  },
  {
    id: 'wood',
    name: 'Wood',
    value: 1,
    quantity: 20,
    terrainDistribution: {
      plains: 10,
      desert: 0,
      forest: 50,
      mountain: 1,
      river: 0,
      lake: 0
    }
  },
  {
    id: 'stone',
    name: 'Stone',
    value: 1,
    quantity: 20,
    terrainDistribution: {
      plains: 5,
      desert: 1,
      forest: 10,
      mountain: 50,
      river: 2,
      lake: 2
    }
  },
  {
    id: 'water',
    name: 'Water',
    value: 2,
    quantity: 20,
    terrainDistribution: {
      plains: 5,
      desert: 1,
      forest: 5,
      mountain: 1,
      river: 100,
      lake: 100
    }
  },
  {
    id: 'shard',
    name: 'Shard',
    value: 3,
    quantity: 10,
    terrainDistribution: {
      plains: 5,
      desert: 10,
      forest: 2,
      mountain: 1,
      river: 0,
      lake: 0
    }
  },
  {
    id: 'gems',
    name: 'Gems',
    value: 5,
    quantity: 10,
    terrainDistribution: {
      plains: 2,
      desert: 0,
      forest: 0,
      mountain: 10,
      river: 25,
      lake: 50
    }
  }
];

// Item database
export const itemDatabase: ItemData[] = [
  {
    id: 'boat',
    name: 'Boat',
    minUses: 5,
    maxUses: 7,
    quantity: 5,
    craftingRequirements: { cloth: 2, wood: 2 },
    effects: ['Required for travelling on rivers and lakes', 'If it breaks due to storm, player dies']
  },
  {
    id: 'camping_gear',
    name: 'Camping Gear',
    minUses: 1,
    maxUses: 3,
    quantity: 10,
    craftingRequirements: { cloth: 1, wood: 1 },
    effects: ['Removes damage from being on forest tiles']
  },
  {
    id: 'climbing_gear',
    name: 'Climbing Gear',
    minUses: 1,
    maxUses: 5,
    quantity: 5,
    craftingRequirements: { cloth: 2, water: 1, stone: 1 },
    effects: ['Required for travelling on mountains', 'If no uses left, player cannot leave the mountain']
  },
  {
    id: 'cloak',
    name: 'Cloak',
    minUses: 1,
    maxUses: 5,
    quantity: 10,
    craftingRequirements: { cloth: 2 },
    effects: ['Reduces damage from sandstorms']
  },
  {
    id: 'survival_kit',
    name: 'Survival Kit',
    minUses: 1,
    maxUses: 3,
    quantity: 10,
    craftingRequirements: { cloth: 1, water: 1 },
    effects: ['Reduces damage from wildfire']
  },
  {
    id: 'terraform',
    name: 'Terraform',
    minUses: 1,
    maxUses: 1,
    quantity: 5,
    craftingRequirements: {},
    effects: ['Can make three tiles active']
  },
  {
    id: 'leech',
    name: 'Leech',
    minUses: 1,
    maxUses: 1,
    quantity: 5,
    craftingRequirements: {},
    effects: ['Can make two tiles inactive']
  },
  {
    id: 'armageddon',
    name: 'Armageddon',
    minUses: 1,
    maxUses: 1,
    quantity: 3,
    craftingRequirements: {},
    effects: ['Everyone gets 2 damage']
  },
  {
    id: 'rejuvenate',
    name: 'Rejuvenate',
    minUses: 1,
    maxUses: 1,
    quantity: 5,
    craftingRequirements: {},
    effects: ['Get +3 HP']
  }
];

// Harvest grid generation
export class HarvestGrid {
  private slots: HarvestSlot[];
  private resourcePools: Map<string, ResourceData[]>;
  private itemPool: ItemData[];

  constructor() {
    this.slots = [];
    this.resourcePools = new Map();
    this.itemPool = [...itemDatabase];
    this.initializeGrid();
  }

  private initializeGrid() {
    // Create 6 columns (one for each terrain type)
    const terrainTypes: TerrainType[] = ['plains', 'desert', 'forest', 'mountain', 'river', 'lake'];
    
    terrainTypes.forEach(terrain => {
      this.slots.push({
        id: `slot_${terrain}`,
        terrainType: terrain,
        items: []
      });
    });

    // Initialize resource pools for each terrain
    this.populateResourcePools();
    
    // Fill initial grid
    this.refillGrid();
  }

  private populateResourcePools() {
    const terrainTypes: TerrainType[] = ['plains', 'desert', 'forest', 'mountain', 'river', 'lake'];
    
    terrainTypes.forEach(terrain => {
      const pool: ResourceData[] = [];
      
      resourceDatabase.forEach(resource => {
        const percentage = resource.terrainDistribution[terrain];
        const count = Math.floor((percentage / 100) * resource.quantity);
        
        // Add resources to pool based on distribution
        for (let i = 0; i < count; i++) {
          pool.push({ ...resource });
        }
      });
      
      // Shuffle the pool
      this.shuffleArray(pool);
      this.resourcePools.set(terrain, pool);
    });
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  public refillGrid(): void {
    this.slots.forEach(slot => {
      // Fill with resources from terrain pool
      const pool = this.resourcePools.get(slot.terrainType) || [];
      slot.items = [];
      
      // Add up to 3 resources from the pool
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const resource = pool.pop();
        if (resource) {
          slot.items.push(resource);
        }
      }
      
      // Add items randomly (items can be harvested from any terrain for 3 AP)
      // Each slot has a small chance to contain an item
      if (Math.random() < 0.1 && this.itemPool.length > 0) { // 10% chance
        const randomIndex = Math.floor(Math.random() * this.itemPool.length);
        const item = this.itemPool.splice(randomIndex, 1)[0];
        if (item) {
          // Generate random uses within the item's range
          const uses = Math.floor(Math.random() * (item.maxUses - item.minUses + 1)) + item.minUses;
          slot.items.push({
            ...item,
            minUses: uses,
            maxUses: uses
          });
        }
      }
    });
  }

  public harvestResource(terrainType: TerrainType, slotIndex: number): ResourceData | null {
    const slot = this.slots.find(s => s.terrainType === terrainType);
    if (!slot || slotIndex >= slot.items.length) {
      return null;
    }

    const item = slot.items[slotIndex];
    if ('terrainDistribution' in item) {
      // It's a resource
      slot.items.splice(slotIndex, 1);
      
      // Refill from pool if available
      const pool = this.resourcePools.get(terrainType);
      if (pool && pool.length > 0) {
        const newResource = pool.pop();
        if (newResource) {
          slot.items.push(newResource);
        }
      }
      
      return item as ResourceData;
    }
    
    return null;
  }

  public harvestItem(slotIndex: number): ItemData | null {
    // Items are harvested directly from the item database (top 3 only)
    if (slotIndex >= 0 && slotIndex < 3 && slotIndex < itemDatabase.length) {
      const itemTemplate = itemDatabase[slotIndex];

      // Generate item with random uses
      const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;

      return {
        ...itemTemplate,
        minUses: uses,
        maxUses: uses
      };
    }
    
    return null;
  }

  public craftItem(itemId: string, playerResources: { [resourceId: string]: number }): ItemData | null {
    const itemTemplate = itemDatabase.find(item => item.id === itemId);
    if (!itemTemplate) {
      return null;
    }

    // Check if player has required resources
    for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
      if ((playerResources[resourceId] || 0) < required) {
        return null; // Not enough resources
      }
    }

    // Generate item with random uses
    const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
    
    return {
      ...itemTemplate,
      minUses: uses,
      maxUses: uses
    };
  }

  public getVisibleItems(terrainType: TerrainType): (ResourceData | ItemData)[] {
    const slot = this.slots.find(s => s.terrainType === terrainType);
    return slot ? slot.items.slice(0, 3) : []; // Only show top 3 items
  }

  public getAllSlots(): HarvestSlot[] {
    return this.slots;
  }

  public getResourceTotals(): { [terrainType: string]: number } {
    const totals: { [terrainType: string]: number } = {};
    
    this.slots.forEach(slot => {
      totals[slot.terrainType] = slot.items.filter(item => 'terrainDistribution' in item).length;
    });
    
    return totals;
  }

  public getItemCount(): number {
    return this.slots.reduce((total, slot) => {
      return total + slot.items.filter(item => 'craftingRequirements' in item).length;
    }, 0);
  }
}

// Helper functions
export function calculateItemValue(item: ItemData): number {
  // Item value is based on remaining uses
  // Base value could be sum of crafting requirements + bonus for uses
  const baseValue = Object.values(item.craftingRequirements).reduce((sum, cost) => sum + cost, 0);
  return baseValue + item.minUses; // Simplified calculation
}

export function getResourceById(id: string): ResourceData | undefined {
  return resourceDatabase.find(resource => resource.id === id);
}

export function getItemById(id: string): ItemData | undefined {
  return itemDatabase.find(item => item.id === id);
}

export function canCraftItem(itemId: string, playerResources: { [resourceId: string]: number }): boolean {
  const item = getItemById(itemId);
  if (!item) return false;

  return Object.entries(item.craftingRequirements).every(([resourceId, required]) => 
    (playerResources[resourceId] || 0) >= required
  );
}
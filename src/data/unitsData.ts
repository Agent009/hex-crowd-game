// Army unit definitions for the hero army system.
export interface UnitData {
  id: string;
  name: string;
  icon: string;
  tier: number;
  attack: number;
  defense: number;
  hp: number;
  cost: { [resourceId: string]: number };
  apCost: number;
  description: string;
}

export const unitsData: { [unitId: string]: UnitData } = {
  militia: {
    id: 'militia',
    name: 'Militia',
    icon: '🗡️',
    tier: 1,
    attack: 1,
    defense: 0,
    hp: 2,
    cost: { wood: 1 },
    apCost: 1,
    description: 'Cheap conscripts. They hold the line, briefly.',
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    icon: '🏹',
    tier: 2,
    attack: 2,
    defense: 1,
    hp: 2,
    cost: { wood: 1, cloth: 1 },
    apCost: 1,
    description: 'Ranged support that adds reliable attack power.',
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    icon: '🐎',
    tier: 3,
    attack: 3,
    defense: 3,
    hp: 4,
    cost: { stone: 2, shard: 1 },
    apCost: 1,
    description: 'Armored cavalry. Excellent in attack and defense.',
  },
  griffin: {
    id: 'griffin',
    name: 'Griffin',
    icon: '🦅',
    tier: 4,
    attack: 5,
    defense: 2,
    hp: 5,
    cost: { gems: 1, shard: 1 },
    apCost: 2,
    description: 'A winged terror. The strongest sword an army can field.',
  },
};

export const unitList: UnitData[] = Object.values(unitsData);

/** Maximum total units a single hero can command. */
export const MAX_ARMY_SIZE = 12;

export const armyUnitCount = (army: { unitId: string; count: number }[]): number =>
  army.reduce((sum, stack) => sum + stack.count, 0);

export const armyAttack = (army: { unitId: string; count: number }[]): number =>
  army.reduce((sum, stack) => {
    const unit = unitsData[stack.unitId];
    return sum + (unit ? unit.attack * stack.count : 0);
  }, 0);

export const armyDefense = (army: { unitId: string; count: number }[]): number =>
  army.reduce((sum, stack) => {
    const unit = unitsData[stack.unitId];
    return sum + (unit ? unit.defense * stack.count : 0);
  }, 0);

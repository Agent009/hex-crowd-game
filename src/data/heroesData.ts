// Hero class definitions, recruitment rules, and leveling curves
import { Hero } from '../store/types';
import { skillEffectAtRank } from './skillsData';

export interface HeroStatBlock {
  attack: number;
  defense: number;
  spellPower: number;
  knowledge: number;
}

export interface HeroClassData {
  id: string;
  name: string;
  icon: string; // emoji portrait used on board badges and panels
  description: string;
  baseStats: HeroStatBlock;
  growth: HeroStatBlock; // stat gain applied on each level-up
  spellbook: string[]; // spells learned in order (first at recruit, then every even level)
  namePool: string[];
}

export const heroClasses: { [classId: string]: HeroClassData } = {
  knight: {
    id: 'knight',
    name: 'Knight',
    icon: '⚔️',
    description: 'A frontline commander. Strong attack and defense, little magic.',
    baseStats: { attack: 3, defense: 3, spellPower: 0, knowledge: 1 },
    growth: { attack: 2, defense: 2, spellPower: 0, knowledge: 0 },
    spellbook: ['stone_skin', 'swift_wind'],
    namePool: ['Sir Roland', 'Lady Catherine', 'Sir Edric', 'Dame Sorsha'],
  },
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    icon: '🪓',
    description: 'A relentless raider. Highest attack in the realm.',
    baseStats: { attack: 4, defense: 2, spellPower: 0, knowledge: 0 },
    growth: { attack: 3, defense: 1, spellPower: 0, knowledge: 0 },
    spellbook: ['swift_wind'],
    namePool: ['Krag', 'Yog', 'Gretchin', 'Tarnum'],
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    description: 'A swift wanderer of the wilds. Balanced stats and mobility magic.',
    baseStats: { attack: 2, defense: 2, spellPower: 1, knowledge: 1 },
    growth: { attack: 1, defense: 1, spellPower: 1, knowledge: 1 },
    spellbook: ['swift_wind', 'healing_light', 'stone_skin'],
    namePool: ['Lyra', 'Mephala', 'Ryland', 'Elleron'],
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: '🛡️',
    description: 'A holy guardian. Stout defense and healing prowess.',
    baseStats: { attack: 2, defense: 4, spellPower: 1, knowledge: 1 },
    growth: { attack: 1, defense: 2, spellPower: 1, knowledge: 0 },
    spellbook: ['healing_light', 'stone_skin', 'lightning_bolt'],
    namePool: ['Aelora', 'Tyris', 'Caitlin', 'Rion'],
  },
  sorceress: {
    id: 'sorceress',
    name: 'Sorceress',
    icon: '🔮',
    description: 'A weaver of destructive magic. Devastating spell power.',
    baseStats: { attack: 1, defense: 1, spellPower: 4, knowledge: 2 },
    growth: { attack: 0, defense: 1, spellPower: 2, knowledge: 1 },
    spellbook: ['fireball', 'lightning_bolt', 'drain_life', 'swift_wind'],
    namePool: ['Vivien', 'Selene', 'Morgana', 'Isolde'],
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    icon: '🧙',
    description: 'A master of arcane knowledge. Deep mana reserves.',
    baseStats: { attack: 1, defense: 1, spellPower: 3, knowledge: 4 },
    growth: { attack: 0, defense: 0, spellPower: 2, knowledge: 2 },
    spellbook: ['lightning_bolt', 'fireball', 'swift_wind', 'stone_skin'],
    namePool: ['Aldous', 'Theodorus', 'Cyra', 'Bartholo'],
  },
  druid: {
    id: 'druid',
    name: 'Druid',
    icon: '🌿',
    description: 'A keeper of nature. Restores life and bends the land.',
    baseStats: { attack: 1, defense: 2, spellPower: 2, knowledge: 3 },
    growth: { attack: 1, defense: 1, spellPower: 1, knowledge: 1 },
    spellbook: ['healing_light', 'stone_skin', 'drain_life'],
    namePool: ['Elathan', 'Bryony', 'Faelan', 'Wynne'],
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    icon: '💀',
    description: 'A harvester of souls. Drains life from foes.',
    baseStats: { attack: 2, defense: 1, spellPower: 3, knowledge: 2 },
    growth: { attack: 1, defense: 0, spellPower: 2, knowledge: 1 },
    spellbook: ['drain_life', 'fireball', 'lightning_bolt'],
    namePool: ['Sandro', 'Vidomina', 'Moander', 'Nimbus'],
  },
};

export const heroClassList: HeroClassData[] = Object.values(heroClasses);

// Recruitment rules
export const HERO_RECRUIT_AP_COST = 2;
export const HERO_RECRUIT_RESOURCE_COST: { [resourceId: string]: number } = {
  wood: 2,
  stone: 1,
};
export const MAX_HEROES_PER_PLAYER = 1;

// Hero vitals
export const HERO_BASE_HP = 10;
export const HERO_HP_PER_LEVEL = 2;
export const HERO_BASE_MANA = 6;
export const HERO_MANA_PER_KNOWLEDGE = 2;
export const HERO_BASE_MANA_REGEN = 1;

// Rest action: each AP spent restores this much hero HP and mana
export const REST_HP_PER_AP = 2;
export const REST_MANA_PER_AP = 2;

// XP needed to advance FROM the given level to the next one
export const xpToNextLevel = (level: number): number => 100 * level;

export const heroMaxHp = (level: number, enduranceBonus: number = 0): number =>
  HERO_BASE_HP + (level - 1) * HERO_HP_PER_LEVEL + enduranceBonus;

export const heroMaxMana = (knowledge: number, wisdomBonus: number = 0): number =>
  HERO_BASE_MANA + knowledge * HERO_MANA_PER_KNOWLEDGE + wisdomBonus;

const heroSkillRank = (hero: Hero, skillId: string): number =>
  hero.skills.find(s => s.skillId === skillId)?.rank ?? 0;

/** Recompute max HP / max mana from level, knowledge, and skills; clamps current values. */
export const recalcHeroDerivedStats = (hero: Hero): void => {
  const enduranceBonus = skillEffectAtRank('endurance', heroSkillRank(hero, 'endurance'));
  const wisdomBonus = skillEffectAtRank('wisdom', heroSkillRank(hero, 'wisdom'));

  const prevMaxHp = hero.maxHp;
  const prevMaxMana = hero.maxMana;

  hero.maxHp = heroMaxHp(hero.level, enduranceBonus);
  hero.maxMana = heroMaxMana(hero.knowledge, wisdomBonus);

  // Growing a maximum grants the difference immediately; shrinking clamps.
  hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(0, hero.maxHp - prevMaxHp));
  hero.mana = Math.min(hero.maxMana, hero.mana + Math.max(0, hero.maxMana - prevMaxMana));
};

/**
 * Grant XP to a hero, applying any level-ups (stat growth, skill points,
 * new spells on even levels). Mutates the hero (Immer-safe inside reducers).
 * Returns human-readable messages for the activity log.
 */
export const grantHeroXp = (hero: Hero, amount: number): string[] => {
  const messages: string[] = [];
  if (amount <= 0) return messages;

  const classData = heroClasses[hero.classId];
  hero.xp += amount;

  while (hero.xp >= hero.xpToNext) {
    hero.xp -= hero.xpToNext;
    hero.level += 1;
    hero.xpToNext = xpToNextLevel(hero.level);
    hero.skillPoints += 1;

    if (classData) {
      hero.attack += classData.growth.attack;
      hero.defense += classData.growth.defense;
      hero.spellPower += classData.growth.spellPower;
      hero.knowledge += classData.growth.knowledge;
    }

    recalcHeroDerivedStats(hero);
    hero.hp = hero.maxHp; // a level-up restores the hero to full health

    messages.push(`${hero.name} reached level ${hero.level}! (+1 skill point)`);

    // Learn the next spell from the class spellbook on even levels.
    if (classData && hero.level % 2 === 0) {
      const nextSpell = classData.spellbook.find(s => !hero.knownSpells.includes(s));
      if (nextSpell) {
        hero.knownSpells.push(nextSpell);
        messages.push(`${hero.name} learned a new spell!`);
      }
    }
  }

  return messages;
};

/**
 * Build a fresh level-1 hero for a player.
 * `seed` keeps name selection deterministic (player number works well).
 */
export const createHero = (
  classId: string,
  ownerId: string,
  heroId: string,
  seed: number
): Hero | null => {
  const classData = heroClasses[classId];
  if (!classData) return null;

  const name = classData.namePool[Math.abs(seed) % classData.namePool.length];
  const knowledge = classData.baseStats.knowledge;

  return {
    id: heroId,
    classId,
    name,
    ownerId,
    level: 1,
    xp: 0,
    xpToNext: xpToNextLevel(1),
    attack: classData.baseStats.attack,
    defense: classData.baseStats.defense,
    spellPower: classData.baseStats.spellPower,
    knowledge,
    hp: heroMaxHp(1),
    maxHp: heroMaxHp(1),
    mana: heroMaxMana(knowledge),
    maxMana: heroMaxMana(knowledge),
    skillPoints: 0,
    skills: [],
    knownSpells: classData.spellbook.length > 0 ? [classData.spellbook[0]] : [],
    army: [],
    defenseBuff: 0,
  };
};

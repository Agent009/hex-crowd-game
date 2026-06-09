// Hero skill definitions. Each skill has 3 ranks; effectPerRank holds the
// cumulative magnitude at rank 1/2/3 (index rank-1).
export interface SkillData {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxRank: number;
  effectPerRank: number[];
  rankLabel: (value: number) => string;
}

export const skillsData: { [skillId: string]: SkillData } = {
  offense: {
    id: 'offense',
    name: 'Offense',
    icon: '⚔️',
    description: 'Sharpens the hero\'s strikes, adding attack power in combat.',
    maxRank: 3,
    effectPerRank: [2, 4, 6],
    rankLabel: (v) => `+${v} attack in combat`,
  },
  armorer: {
    id: 'armorer',
    name: 'Armorer',
    icon: '🛡️',
    description: 'Hardens armor and shields, adding defense power in combat.',
    maxRank: 3,
    effectPerRank: [2, 4, 6],
    rankLabel: (v) => `+${v} defense in combat`,
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics',
    icon: '🥾',
    description: 'Masters efficient travel. At rank 2+, movement costs 1 less AP (minimum 1).',
    maxRank: 3,
    effectPerRank: [0, 1, 1],
    rankLabel: (v) => (v > 0 ? `-${v} AP movement cost (min 1)` : 'Trains toward cheaper movement'),
  },
  wisdom: {
    id: 'wisdom',
    name: 'Wisdom',
    icon: '📖',
    description: 'Expands the hero\'s mana pool.',
    maxRank: 3,
    effectPerRank: [3, 6, 9],
    rankLabel: (v) => `+${v} max mana`,
  },
  mysticism: {
    id: 'mysticism',
    name: 'Mysticism',
    icon: '✨',
    description: 'Regenerates additional mana at each AP renewal.',
    maxRank: 3,
    effectPerRank: [1, 2, 3],
    rankLabel: (v) => `+${v} mana regen per round`,
  },
  endurance: {
    id: 'endurance',
    name: 'Endurance',
    icon: '❤️',
    description: 'Toughens the hero, raising maximum HP.',
    maxRank: 3,
    effectPerRank: [3, 6, 9],
    rankLabel: (v) => `+${v} hero max HP`,
  },
};

export const skillList: SkillData[] = Object.values(skillsData);

/** Cumulative effect magnitude for a hero's skill at the given rank (0 if unlearned). */
export const skillEffectAtRank = (skillId: string, rank: number): number => {
  const skill = skillsData[skillId];
  if (!skill || rank <= 0) return 0;
  const idx = Math.min(rank, skill.maxRank) - 1;
  return skill.effectPerRank[idx];
};

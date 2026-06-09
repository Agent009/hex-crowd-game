// Spell definitions for the hero spell casting system.
// Effect magnitude = basePower + floor(spellPower * spellPowerScaling).
export type SpellKind = 'damage' | 'heal' | 'buff' | 'energize' | 'drain';
export type SpellTarget = 'self' | 'enemy';

export interface SpellData {
  id: string;
  name: string;
  icon: string;
  description: string;
  manaCost: number;
  target: SpellTarget;
  /** Max hex distance to the target player (enemy spells only). */
  range: number;
  kind: SpellKind;
  basePower: number;
  spellPowerScaling: number;
}

export const spellsData: { [spellId: string]: SpellData } = {
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    icon: '🔥',
    description: 'Hurls a ball of fire at an enemy within 2 tiles.',
    manaCost: 4,
    target: 'enemy',
    range: 2,
    kind: 'damage',
    basePower: 2,
    spellPowerScaling: 0.34,
  },
  lightning_bolt: {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    icon: '⚡',
    description: 'Strikes an enemy within 3 tiles with a devastating bolt.',
    manaCost: 6,
    target: 'enemy',
    range: 3,
    kind: 'damage',
    basePower: 3,
    spellPowerScaling: 0.5,
  },
  drain_life: {
    id: 'drain_life',
    name: 'Drain Life',
    icon: '🩸',
    description: 'Siphons life from an adjacent enemy, healing the caster\'s player.',
    manaCost: 5,
    target: 'enemy',
    range: 1,
    kind: 'drain',
    basePower: 2,
    spellPowerScaling: 0.25,
  },
  healing_light: {
    id: 'healing_light',
    name: 'Healing Light',
    icon: '💚',
    description: 'Bathes the caster\'s player in light, restoring HP.',
    manaCost: 3,
    target: 'self',
    range: 0,
    kind: 'heal',
    basePower: 2,
    spellPowerScaling: 0.34,
  },
  stone_skin: {
    id: 'stone_skin',
    name: 'Stone Skin',
    icon: '🪨',
    description: 'Turns the hero\'s skin to stone, raising defense until next round.',
    manaCost: 3,
    target: 'self',
    range: 0,
    kind: 'buff',
    basePower: 2,
    spellPowerScaling: 0.34,
  },
  swift_wind: {
    id: 'swift_wind',
    name: 'Swift Wind',
    icon: '💨',
    description: 'Summons a tailwind, granting the player bonus action points.',
    manaCost: 5,
    target: 'self',
    range: 0,
    kind: 'energize',
    basePower: 2,
    spellPowerScaling: 0.2,
  },
};

export const spellList: SpellData[] = Object.values(spellsData);

/** Final magnitude of a spell for a hero with the given spell power. */
export const spellEffectValue = (spell: SpellData, spellPower: number): number =>
  spell.basePower + Math.floor(spellPower * spell.spellPowerScaling);

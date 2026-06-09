// Pure combat resolution engine. No Redux/Phaser dependencies so it can be
// unit-tested and reused by the host-authoritative multiplayer loop.
import { Hero, ArmyUnitStack } from '../store/types';
import { unitsData, armyAttack, armyDefense } from '../data/unitsData';
import { skillEffectAtRank } from '../data/skillsData';

export const BASE_PLAYER_ATTACK = 2;
export const BASE_PLAYER_DEFENSE = 2;
export const COMBAT_AP_COST = 2;
export const MAX_STRIKE_DAMAGE = 5;
export const COMBAT_ROLL_MAX = 2; // each side rolls 0..2

export const XP_WIN_BASE = 40;
export const XP_WIN_PER_DIFF = 20;
export const XP_WIN_CAP = 120;
export const XP_LOSS = 15;

export interface CombatSideInput {
  playerId: string;
  playerHp: number;
  hero: Hero | null;
  /** Terrain defense bonus — applies to the defender side. */
  terrainDefenseBonus: number;
}

export interface SideDamageReport {
  armyLosses: ArmyUnitStack[];
  heroHpLoss: number;
  heroLost: boolean;
  playerHpDamage: number;
}

export interface CombatComputation {
  attackerPower: number;
  defenderPower: number;
  attackerRoll: number;
  defenderRoll: number;
  diff: number;
  winner: 'attacker' | 'defender' | null;
  damageToDefender: number;
  damageToAttacker: number;
  attackerReport: SideDamageReport;
  defenderReport: SideDamageReport;
  attackerXp: number;
  defenderXp: number;
}

const heroSkillRank = (hero: Hero, skillId: string): number =>
  hero.skills.find(s => s.skillId === skillId)?.rank ?? 0;

/** Total attack contribution of a side (before the dice roll). */
export const sideAttackPower = (side: CombatSideInput): number => {
  let power = BASE_PLAYER_ATTACK;
  if (side.hero) {
    power += side.hero.attack + skillEffectAtRank('offense', heroSkillRank(side.hero, 'offense'));
    power += armyAttack(side.hero.army);
  }
  return power;
};

/** Total defense contribution of a side (before the dice roll). */
export const sideDefensePower = (side: CombatSideInput): number => {
  let power = BASE_PLAYER_DEFENSE + side.terrainDefenseBonus;
  if (side.hero) {
    power += side.hero.defense + side.hero.defenseBuff;
    power += skillEffectAtRank('armorer', heroSkillRank(side.hero, 'armorer'));
    power += armyDefense(side.hero.army);
  }
  return power;
};

/**
 * Distribute incoming damage across a side: army units absorb first
 * (weakest tier dies first), then the hero, then the player's HP.
 * Does not mutate inputs — returns a report the caller applies to state.
 */
export const distributeDamage = (
  damage: number,
  army: ArmyUnitStack[],
  hero: Hero | null
): SideDamageReport => {
  let remaining = damage;
  const armyLosses: ArmyUnitStack[] = [];

  if (hero) {
    const stacks = [...army]
      .map(s => ({ ...s }))
      .sort((a, b) => (unitsData[a.unitId]?.tier ?? 99) - (unitsData[b.unitId]?.tier ?? 99));

    for (const stack of stacks) {
      const unit = unitsData[stack.unitId];
      if (!unit) continue;
      let killed = 0;
      while (remaining >= unit.hp && stack.count - killed > 0) {
        remaining -= unit.hp;
        killed++;
      }
      // A wounded survivor soaks the leftover damage without dying.
      if (remaining > 0 && stack.count - killed > 0) {
        remaining = 0;
      }
      if (killed > 0) {
        armyLosses.push({ unitId: stack.unitId, count: killed });
      }
      if (remaining <= 0) break;
    }
  }

  let heroHpLoss = 0;
  let heroLost = false;
  if (remaining > 0 && hero) {
    heroHpLoss = Math.min(hero.hp, remaining);
    remaining -= heroHpLoss;
    heroLost = heroHpLoss >= hero.hp;
  }

  const playerHpDamage = Math.max(0, remaining);

  return { armyLosses, heroHpLoss, heroLost, playerHpDamage };
};

/**
 * Resolve a full combat round between two sides.
 * `rng` returns [0, 1) — injectable for deterministic tests.
 */
export const resolveCombat = (
  attacker: CombatSideInput,
  defender: CombatSideInput,
  rng: () => number = Math.random
): CombatComputation => {
  const attackerRoll = Math.floor(rng() * (COMBAT_ROLL_MAX + 1));
  const defenderRoll = Math.floor(rng() * (COMBAT_ROLL_MAX + 1));

  const attackerPower = sideAttackPower(attacker) + attackerRoll;
  const defenderPower = sideDefensePower(defender) + defenderRoll;
  const diff = attackerPower - defenderPower;

  let damageToDefender: number;
  let damageToAttacker: number;
  let winner: 'attacker' | 'defender' | null;

  if (diff > 0) {
    winner = 'attacker';
    damageToDefender = Math.min(MAX_STRIKE_DAMAGE, Math.max(1, Math.ceil(diff / 2)));
    damageToAttacker = 1; // counterattack chip
  } else if (diff < 0) {
    winner = 'defender';
    damageToAttacker = Math.min(MAX_STRIKE_DAMAGE - 1, Math.max(1, Math.ceil(-diff / 2)));
    damageToDefender = 1; // the assault still draws blood
  } else {
    winner = null;
    damageToDefender = 1;
    damageToAttacker = 1;
  }

  const defenderReport = distributeDamage(damageToDefender, defender.hero?.army ?? [], defender.hero);
  const attackerReport = distributeDamage(damageToAttacker, attacker.hero?.army ?? [], attacker.hero);

  const winXp = Math.min(XP_WIN_CAP, XP_WIN_BASE + Math.abs(diff) * XP_WIN_PER_DIFF);
  const attackerXp = winner === 'attacker' ? winXp : XP_LOSS;
  const defenderXp = winner === 'defender' ? winXp : XP_LOSS;

  return {
    attackerPower,
    defenderPower,
    attackerRoll,
    defenderRoll,
    diff,
    winner,
    damageToDefender,
    damageToAttacker,
    attackerReport,
    defenderReport,
    attackerXp,
    defenderXp,
  };
};

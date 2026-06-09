import { describe, expect, it } from 'vitest';
import { createHero } from '../data/heroesData';
import { resolveCombat, sideAttackPower, sideDefensePower } from './combat';

describe('combat engine', () => {
  it('adds hero and army strength to side power', () => {
    const hero = createHero('knight', 'player_1', 'hero_1', 1);
    expect(hero).not.toBeNull();
    hero!.army = [{ unitId: 'militia', count: 2 }];

    expect(sideAttackPower({ playerId: 'player_1', playerHp: 10, hero, terrainDefenseBonus: 0 })).toBe(7);
    expect(sideDefensePower({ playerId: 'player_1', playerHp: 10, hero, terrainDefenseBonus: 2 })).toBe(7);
  });

  it('is deterministic when supplied a seeded roll stream', () => {
    const attackerHero = createHero('barbarian', 'attacker', 'hero_a', 1);
    const defenderHero = createHero('wizard', 'defender', 'hero_d', 2);
    expect(attackerHero).not.toBeNull();
    expect(defenderHero).not.toBeNull();

    const rolls = [0.99, 0];
    const result = resolveCombat(
      { playerId: 'attacker', playerHp: 10, hero: attackerHero, terrainDefenseBonus: 0 },
      { playerId: 'defender', playerHp: 10, hero: defenderHero, terrainDefenseBonus: 0 },
      () => rolls.shift() ?? 0
    );

    expect(result.attackerRoll).toBe(2);
    expect(result.defenderRoll).toBe(0);
    expect(result.winner).toBe('attacker');
    expect(result.damageToDefender).toBeGreaterThan(result.damageToAttacker);
    expect(result.attackerXp).toBeGreaterThan(result.defenderXp);
  });
});

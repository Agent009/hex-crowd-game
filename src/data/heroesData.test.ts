import { describe, expect, it } from 'vitest';
import {
  createHero,
  grantHeroXp,
  heroClasses,
  recalcHeroDerivedStats,
  xpToNextLevel,
} from './heroesData';

const knight = () => createHero('knight', 'player_a', 'hero_1', 1)!;

describe('hero progression', () => {
  it('creates a level-1 hero from class base stats', () => {
    const hero = knight();
    expect(hero.level).toBe(1);
    expect(hero.attack).toBe(heroClasses.knight.baseStats.attack);
    expect(hero.knownSpells).toContain(heroClasses.knight.spellbook[0]);
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('levels up, applies stat growth, and awards a skill point', () => {
    const hero = knight();
    const messages = grantHeroXp(hero, xpToNextLevel(1));

    expect(hero.level).toBe(2);
    expect(hero.skillPoints).toBe(1);
    expect(hero.attack).toBe(heroClasses.knight.baseStats.attack + heroClasses.knight.growth.attack);
    expect(hero.xp).toBe(0);
    expect(hero.xpToNext).toBe(xpToNextLevel(2));
    expect(messages.some(m => m.includes('level 2'))).toBe(true);
  });

  it('handles multi-level jumps from a single large XP grant', () => {
    const hero = knight();
    grantHeroXp(hero, xpToNextLevel(1) + xpToNextLevel(2) + 10);

    expect(hero.level).toBe(3);
    expect(hero.skillPoints).toBe(2);
    expect(hero.xp).toBe(10);
  });

  it('learns a new class spell on even levels', () => {
    const hero = knight();
    const before = hero.knownSpells.length;
    grantHeroXp(hero, xpToNextLevel(1)); // -> level 2
    expect(hero.knownSpells.length).toBeGreaterThan(before);
  });

  it('grows max HP/mana via skills and grants the difference immediately', () => {
    const hero = knight();
    hero.skills.push({ skillId: 'endurance', rank: 1 });
    const prevMaxHp = hero.maxHp;
    recalcHeroDerivedStats(hero);
    expect(hero.maxHp).toBeGreaterThan(prevMaxHp);
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('ignores non-positive XP grants', () => {
    const hero = knight();
    expect(grantHeroXp(hero, 0)).toEqual([]);
    expect(hero.level).toBe(1);
  });
});

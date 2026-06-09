import { describe, expect, it } from 'vitest';
import gameReducer, {
  castSpell,
  initiateCombat,
  joinGame,
  learnSkill,
  recruitHero,
  recruitUnit,
  restHero,
  startGame,
  togglePlayerReady,
} from './gameSlice';
import { GameState } from './gameSlice';
import { HexTile } from '../utils/hexGrid';

const withInteractionResources = (state: GameState): GameState => {
  const next = structuredClone(state) as GameState;
  next.currentPhase = 'interaction';
  next.players.forEach((player, index) => {
    player.position = index === 0
      ? { q: 0, r: 0, s: 0 }
      : { q: 1, r: -1, s: 0 };
    next.playerStats[player.id] = {
      ...next.playerStats[player.id],
      actionPoints: 10,
      resources: {
        cloth: 10,
        wood: 10,
        stone: 10,
        water: 10,
        shard: 10,
        gems: 10,
      },
    };
  });
  return next;
};

const twoPlayerState = (): GameState => {
  let state = gameReducer(undefined, joinGame({ playerName: 'Ava', playerId: 'player_a' }));
  state = gameReducer(state, joinGame({ playerName: 'Ben', playerId: 'player_b' }));
  return withInteractionResources(state);
};

describe('game slice hero and combat reducers', () => {
  it('preserves caller-provided player IDs for multiplayer joins', () => {
    const state = gameReducer(undefined, joinGame({ playerName: 'Ava', playerId: 'stable_player_id' }));

    expect(state.players).toHaveLength(1);
    expect(state.players[0].id).toBe('stable_player_id');
    expect(state.playerStats.stable_player_id).toBeDefined();
  });

  it('recruits a hero, learns a skill, rests, casts, and recruits a unit', () => {
    let state = twoPlayerState();
    state = gameReducer(state, recruitHero({ playerId: 'player_a', classId: 'knight' }));

    expect(state.heroes).toHaveLength(1);
    expect(state.heroes[0].ownerId).toBe('player_a');
    expect(state.playerStats.player_a.actionPoints).toBe(8);

    let editable = structuredClone(state) as GameState;
    editable.heroes[0].skillPoints = 1;
    const maxHpBeforeSkill = editable.heroes[0].maxHp;
    state = gameReducer(editable, learnSkill({ playerId: 'player_a', skillId: 'endurance' }));

    expect(state.heroes[0].skills).toEqual([{ skillId: 'endurance', rank: 1 }]);
    expect(state.heroes[0].maxHp).toBeGreaterThan(maxHpBeforeSkill);

    state = gameReducer(state, recruitUnit({ playerId: 'player_a', unitId: 'militia' }));
    expect(state.heroes[0].army).toEqual([{ unitId: 'militia', count: 1 }]);

    state = gameReducer(state, castSpell({ playerId: 'player_a', spellId: 'stone_skin' }));
    expect(state.heroes[0].defenseBuff).toBeGreaterThan(0);

    editable = structuredClone(state) as GameState;
    editable.playerStats.player_a.actionPoints = 2;
    editable.heroes[0].hp = 5;
    editable.heroes[0].mana = 1;
    state = gameReducer(editable, restHero({ playerId: 'player_a' }));

    expect(state.playerStats.player_a.actionPoints).toBe(0);
    expect(state.heroes[0].hp).toBeGreaterThan(5);
    expect(state.heroes[0].mana).toBeGreaterThan(1);
  });

  it('creates a combat report for adjacent enemies', () => {
    let state = twoPlayerState();
    state = gameReducer(state, recruitHero({ playerId: 'player_a', classId: 'barbarian' }));

    const tiles: Record<string, HexTile> = {
      '0,0,0': {
        coords: { q: 0, r: 0, s: 0 },
        terrain: 'plains',
        explored: true,
        visible: true,
        fogLevel: 2,
      },
      '1,-1,0': {
        coords: { q: 1, r: -1, s: 0 },
        terrain: 'forest',
        explored: true,
        visible: true,
        fogLevel: 2,
      },
    };

    const apBefore = state.playerStats.player_a.actionPoints;
    state = gameReducer(state, initiateCombat({
      attackerId: 'player_a',
      defenderId: 'player_b',
      tiles,
    }));

    expect(state.lastCombatResult).not.toBeNull();
    expect(state.lastCombatResult?.attacker.playerId).toBe('player_a');
    expect(state.lastCombatResult?.defender.playerId).toBe('player_b');
    expect(state.playerStats.player_a.actionPoints).toBeLessThan(apBefore);
  });

  it('fills and starts a 30-player game with balanced configured teams', () => {
    const startedAt = performance.now();
    let state = gameReducer(undefined, { type: 'test/init' });

    for (let index = 1; index <= 30; index += 1) {
      state = gameReducer(state, joinGame({
        playerName: `Player ${index}`,
        playerId: `player_${index}`,
      }));
    }

    state = gameReducer(state, joinGame({
      playerName: 'Overflow',
      playerId: 'player_overflow',
    }));

    expect(state.players).toHaveLength(30);
    expect(new Set(state.players.map(player => player.id)).size).toBe(30);
    expect(new Set(state.players.map(player => player.number)).size).toBe(30);
    const teamSizes = state.teams.map(team => team.playerIds.length);
    expect(Math.max(...teamSizes) - Math.min(...teamSizes)).toBeLessThanOrEqual(1);
    expect(teamSizes.reduce((total, size) => total + size, 0)).toBe(30);
    expect(state.currentPlayer?.id).toBe('player_1');

    state.players
      .filter(player => !player.isReady)
      .forEach(player => {
        state = gameReducer(state, togglePlayerReady({ playerId: player.id }));
      });
    state = gameReducer(state, startGame());

    expect(state.gameMode).toBe('playing');
    expect(state.currentPhase).toBe('round_start');
    expect(state.activityEvents[0].message).toContain('Game started');
    expect(performance.now() - startedAt).toBeLessThan(250);
  });
});

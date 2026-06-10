import { describe, expect, it } from 'vitest';
import { multiplayerActionCreators } from './useMultiplayer';

describe('multiplayer action creators', () => {
  it('builds host-routed gameplay actions with stable payloads', () => {
    expect(multiplayerActionCreators.move('player_a', { q: 1, r: -1, s: 0 })).toEqual({
      type: 'move',
      playerId: 'player_a',
      target: { q: 1, r: -1, s: 0 },
    });

    expect(multiplayerActionCreators.proposeTrade({
      fromPlayerId: 'player_a',
      toPlayerId: 'player_b',
      offeredResources: { wood: 2 },
      requestedResources: { stone: 1 },
    })).toEqual({
      type: 'proposeTrade',
      payload: {
        fromPlayerId: 'player_a',
        toPlayerId: 'player_b',
        offeredResources: { wood: 2 },
        requestedResources: { stone: 1 },
      },
    });

    expect(multiplayerActionCreators.castSpell({
      playerId: 'player_a',
      spellId: 'arcane_bolt',
      targetPlayerId: 'player_b',
    })).toEqual({
      type: 'castSpell',
      payload: {
        playerId: 'player_a',
        spellId: 'arcane_bolt',
        targetPlayerId: 'player_b',
      },
    });

    expect(multiplayerActionCreators.initiateCombat('player_a', 'player_b')).toEqual({
      type: 'initiateCombat',
      attackerId: 'player_a',
      defenderId: 'player_b',
    });

    expect(multiplayerActionCreators.start('player_host')).toEqual({
      type: 'start',
      playerId: 'player_host',
    });

    expect(multiplayerActionCreators.forceNextPhase('player_host')).toEqual({
      type: 'forceNextPhase',
      playerId: 'player_host',
    });

    expect(multiplayerActionCreators.endGame('player_host')).toEqual({
      type: 'endGame',
      playerId: 'player_host',
    });
  });

  it('covers the full send-action surface exposed by useMultiplayer', () => {
    expect(Object.keys(multiplayerActionCreators).sort()).toEqual([
      'acceptTrade',
      'cancelTrade',
      'castSpell',
      'craft',
      'endGame',
      'forceNextPhase',
      'harvest',
      'initiateCombat',
      'learnSkill',
      'move',
      'proposeTrade',
      'ready',
      'recruitHero',
      'recruitUnit',
      'rejectTrade',
      'restHero',
      'start',
      'useItem',
    ]);
  });
});

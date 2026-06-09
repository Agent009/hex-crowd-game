import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { realtimeService } from '../services/RealtimeService';
import type { GameAction } from '../services/RealtimeService';
import type { CubeCoords, HexTile } from '../utils/hexGrid';

type HarvestActionPayload = {
  playerId: string;
  tileCoords: CubeCoords;
  resourceId?: string;
  itemId?: string;
  isItem: boolean;
  tiles: { [key: string]: HexTile };
  activeTiles: string[];
};

type TradeProposalPayload = {
  fromPlayerId: string;
  toPlayerId: string;
  offeredResources: { [resourceId: string]: number };
  requestedResources: { [resourceId: string]: number };
};

type CastSpellPayload = {
  playerId: string;
  spellId: string;
  targetPlayerId?: string;
};

export const multiplayerActionCreators = {
  move: (playerId: string, target: CubeCoords): GameAction => ({ type: 'move', playerId, target }),
  harvest: (payload: HarvestActionPayload): GameAction => ({ type: 'harvest', payload }),
  craft: (playerId: string, itemId: string): GameAction => ({ type: 'craft', playerId, itemId }),
  useItem: (playerId: string, itemId: string): GameAction => ({ type: 'useItem', playerId, itemId }),
  ready: (playerId: string): GameAction => ({ type: 'ready', playerId }),
  start: (): GameAction => ({ type: 'start' }),
  proposeTrade: (payload: TradeProposalPayload): GameAction => ({ type: 'proposeTrade', payload }),
  acceptTrade: (payload: { tradeId: string; acceptingPlayerId: string }): GameAction => ({ type: 'acceptTrade', payload }),
  rejectTrade: (payload: { tradeId: string; rejectingPlayerId: string }): GameAction => ({ type: 'rejectTrade', payload }),
  cancelTrade: (payload: { tradeId: string; cancellingPlayerId: string }): GameAction => ({ type: 'cancelTrade', payload }),
  recruitHero: (playerId: string, classId: string): GameAction => ({ type: 'recruitHero', playerId, classId }),
  restHero: (playerId: string): GameAction => ({ type: 'restHero', playerId }),
  learnSkill: (playerId: string, skillId: string): GameAction => ({ type: 'learnSkill', playerId, skillId }),
  castSpell: (payload: CastSpellPayload): GameAction => ({ type: 'castSpell', payload }),
  recruitUnit: (playerId: string, unitId: string): GameAction => ({ type: 'recruitUnit', playerId, unitId }),
  initiateCombat: (attackerId: string, defenderId: string): GameAction => ({ type: 'initiateCombat', attackerId, defenderId }),
  forceNextPhase: (): GameAction => ({ type: 'forceNextPhase' }),
  endGame: (): GameAction => ({ type: 'endGame' }),
};

export const useMultiplayer = () => {
  const session = useSelector((state: RootState) => state.session);
  const isMultiplayer = session.sessionId !== null;
  const isHost = session.isHost;
  const localPlayerId = session.localPlayerId;

  const createSession = useCallback(async (playerName: string) => {
    return realtimeService.createSession(playerName);
  }, []);

  const joinSession = useCallback(async (sessionCode: string, playerName: string) => {
    return realtimeService.joinSession(sessionCode, playerName);
  }, []);

  const reconnectSession = useCallback(async (sessionCode: string, playerId: string, playerName: string) => {
    return realtimeService.reconnectSession(sessionCode, playerId, playerName);
  }, []);

  const getActiveSession = useCallback(async (sessionCode: string) => {
    return realtimeService.getActiveSession(sessionCode);
  }, []);

  const disconnect = useCallback(async () => {
    return realtimeService.disconnect();
  }, []);

  const sendMove = useCallback((playerId: string, target: CubeCoords) => {
    realtimeService.sendAction(multiplayerActionCreators.move(playerId, target));
  }, []);

  const sendHarvest = useCallback((payload: HarvestActionPayload) => {
    realtimeService.sendAction(multiplayerActionCreators.harvest(payload));
  }, []);

  const sendCraft = useCallback((playerId: string, itemId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.craft(playerId, itemId));
  }, []);

  const sendUseItem = useCallback((playerId: string, itemId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.useItem(playerId, itemId));
  }, []);

  const sendReady = useCallback((playerId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.ready(playerId));
  }, []);

  const sendStart = useCallback(() => {
    realtimeService.sendAction(multiplayerActionCreators.start());
  }, []);

  const sendProposeTrade = useCallback((payload: TradeProposalPayload) => {
    realtimeService.sendAction(multiplayerActionCreators.proposeTrade(payload));
  }, []);

  const sendAcceptTrade = useCallback((payload: { tradeId: string; acceptingPlayerId: string }) => {
    realtimeService.sendAction(multiplayerActionCreators.acceptTrade(payload));
  }, []);

  const sendRejectTrade = useCallback((payload: { tradeId: string; rejectingPlayerId: string }) => {
    realtimeService.sendAction(multiplayerActionCreators.rejectTrade(payload));
  }, []);

  const sendCancelTrade = useCallback((payload: { tradeId: string; cancellingPlayerId: string }) => {
    realtimeService.sendAction(multiplayerActionCreators.cancelTrade(payload));
  }, []);

  const sendRecruitHero = useCallback((playerId: string, classId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.recruitHero(playerId, classId));
  }, []);

  const sendRestHero = useCallback((playerId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.restHero(playerId));
  }, []);

  const sendLearnSkill = useCallback((playerId: string, skillId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.learnSkill(playerId, skillId));
  }, []);

  const sendCastSpell = useCallback((payload: CastSpellPayload) => {
    realtimeService.sendAction(multiplayerActionCreators.castSpell(payload));
  }, []);

  const sendRecruitUnit = useCallback((playerId: string, unitId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.recruitUnit(playerId, unitId));
  }, []);

  const sendInitiateCombat = useCallback((attackerId: string, defenderId: string) => {
    realtimeService.sendAction(multiplayerActionCreators.initiateCombat(attackerId, defenderId));
  }, []);

  const sendForceNextPhase = useCallback(() => {
    realtimeService.sendAction(multiplayerActionCreators.forceNextPhase());
  }, []);

  const sendEndGame = useCallback(() => {
    realtimeService.sendAction(multiplayerActionCreators.endGame());
  }, []);

  return {
    isMultiplayer,
    isHost,
    localPlayerId,
    session,
    createSession,
    joinSession,
    reconnectSession,
    getActiveSession,
    disconnect,
    sendMove,
    sendHarvest,
    sendCraft,
    sendUseItem,
    sendReady,
    sendStart,
    sendProposeTrade,
    sendAcceptTrade,
    sendRejectTrade,
    sendCancelTrade,
    sendRecruitHero,
    sendRestHero,
    sendLearnSkill,
    sendCastSpell,
    sendRecruitUnit,
    sendInitiateCombat,
    sendForceNextPhase,
    sendEndGame,
  };
};

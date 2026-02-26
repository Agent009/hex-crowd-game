import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { realtimeService } from '../services/RealtimeService';
import type { CubeCoords, HexTile } from '../utils/hexGrid';

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

  const disconnect = useCallback(async () => {
    return realtimeService.disconnect();
  }, []);

  const sendMove = useCallback((playerId: string, target: CubeCoords) => {
    realtimeService.sendAction({ type: 'move', playerId, target });
  }, []);

  const sendHarvest = useCallback((payload: {
    playerId: string;
    tileCoords: CubeCoords;
    resourceId?: string;
    itemId?: string;
    isItem: boolean;
    tiles: { [key: string]: HexTile };
    activeTiles: string[];
  }) => {
    realtimeService.sendAction({ type: 'harvest', payload });
  }, []);

  const sendCraft = useCallback((playerId: string, itemId: string) => {
    realtimeService.sendAction({ type: 'craft', playerId, itemId });
  }, []);

  const sendUseItem = useCallback((playerId: string, itemId: string) => {
    realtimeService.sendAction({ type: 'useItem', playerId, itemId });
  }, []);

  const sendReady = useCallback((playerId: string) => {
    realtimeService.sendAction({ type: 'ready', playerId });
  }, []);

  const sendStart = useCallback(() => {
    realtimeService.sendAction({ type: 'start' });
  }, []);

  const sendProposeTrade = useCallback((payload: {
    fromPlayerId: string;
    toPlayerId: string;
    offeredResources: { [resourceId: string]: number };
    requestedResources: { [resourceId: string]: number };
  }) => {
    realtimeService.sendAction({ type: 'proposeTrade', payload });
  }, []);

  const sendAcceptTrade = useCallback((payload: { tradeId: string; acceptingPlayerId: string }) => {
    realtimeService.sendAction({ type: 'acceptTrade', payload });
  }, []);

  const sendRejectTrade = useCallback((payload: { tradeId: string; rejectingPlayerId: string }) => {
    realtimeService.sendAction({ type: 'rejectTrade', payload });
  }, []);

  const sendCancelTrade = useCallback((payload: { tradeId: string; cancellingPlayerId: string }) => {
    realtimeService.sendAction({ type: 'cancelTrade', payload });
  }, []);

  const sendForceNextPhase = useCallback(() => {
    realtimeService.sendAction({ type: 'forceNextPhase' });
  }, []);

  const sendEndGame = useCallback(() => {
    realtimeService.sendAction({ type: 'endGame' });
  }, []);

  return {
    isMultiplayer,
    isHost,
    localPlayerId,
    session,
    createSession,
    joinSession,
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
    sendForceNextPhase,
    sendEndGame,
  };
};

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { store } from '../store/store';
import {
  setSession,
  setLocalPlayer,
  setConnectionStatus,
  addConnectedPlayer,
  removeConnectedPlayer,
  promoteToHost,
  setSessionError,
  clearSession,
} from '../store/sessionSlice';
import {
  joinGame,
  leaveGame,
  togglePlayerReady,
  startGame,
  movePlayer,
  harvestFromTile,
  craftItem,
  activateItemEffect,
  proposeTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  syncGameState,
  updatePhaseTimer,
  forceNextPhase,
  endGame,
} from '../store/gameSlice';
import { syncWorldState } from '../store/worldSlice';
import { applyTerraformItem, applyLeechItem } from '../store/itemThunks';
import type { GameState } from '../store/gameSlice';
import type { WorldState } from '../store/types';

type GameAction =
  | { type: 'join'; playerName: string; playerId: string }
  | { type: 'leave'; playerId: string }
  | { type: 'ready'; playerId: string }
  | { type: 'start' }
  | { type: 'move'; playerId: string; target: { q: number; r: number; s: number } }
  | { type: 'harvest'; payload: Parameters<typeof harvestFromTile>[0] }
  | { type: 'craft'; playerId: string; itemId: string }
  | { type: 'useItem'; playerId: string; itemId: string }
  | { type: 'proposeTrade'; payload: Parameters<typeof proposeTrade>[0] }
  | { type: 'acceptTrade'; payload: Parameters<typeof acceptTrade>[0] }
  | { type: 'rejectTrade'; payload: Parameters<typeof rejectTrade>[0] }
  | { type: 'cancelTrade'; payload: Parameters<typeof cancelTrade>[0] }
  | { type: 'forceNextPhase' }
  | { type: 'endGame' };

interface PresenceState {
  playerId: string;
  playerName: string;
}

const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generatePlayerId = (): string => {
  return `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private phaseInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;

  async createSession(playerName: string): Promise<{ sessionCode: string; playerId: string } | null> {
    try {
      store.dispatch(setConnectionStatus('connecting'));

      const playerId = generatePlayerId();
      const sessionCode = generateSessionCode();

      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          session_code: sessionCode,
          host_player_id: playerId,
          game_mode: 'lobby',
          player_count: 1,
          game_config: {},
        })
        .select('id')
        .maybeSingle();

      if (error || !data) {
        store.dispatch(setSessionError(error?.message || 'Failed to create session'));
        return null;
      }

      this.sessionId = data.id;

      store.dispatch(setSession({
        sessionId: data.id,
        sessionCode,
        hostPlayerId: playerId,
        isHost: true,
      }));
      store.dispatch(setLocalPlayer({ playerId, playerName }));

      await this.joinChannel(data.id, playerId, playerName);

      store.dispatch(joinGame({ playerName }));

      const gameState = store.getState().game;
      const justJoinedPlayer = gameState.players.find(p => p.name === playerName);
      if (justJoinedPlayer) {
        store.dispatch(setLocalPlayer({ playerId: justJoinedPlayer.id, playerName }));
      }

      return { sessionCode, playerId };
    } catch (err) {
      store.dispatch(setSessionError('Failed to create session'));
      return null;
    }
  }

  async joinSession(sessionCode: string, playerName: string): Promise<{ playerId: string } | null> {
    try {
      store.dispatch(setConnectionStatus('connecting'));

      const { data: session, error } = await supabase
        .from('game_sessions')
        .select('id, host_player_id, game_mode, player_count, max_players')
        .eq('session_code', sessionCode.toUpperCase())
        .maybeSingle();

      if (error || !session) {
        store.dispatch(setSessionError('Session not found'));
        return null;
      }

      if (session.game_mode !== 'lobby') {
        store.dispatch(setSessionError('Game already in progress'));
        return null;
      }

      if (session.player_count >= session.max_players) {
        store.dispatch(setSessionError('Session is full'));
        return null;
      }

      const playerId = generatePlayerId();
      this.sessionId = session.id;

      store.dispatch(setSession({
        sessionId: session.id,
        sessionCode: sessionCode.toUpperCase(),
        hostPlayerId: session.host_player_id,
        isHost: false,
      }));
      store.dispatch(setLocalPlayer({ playerId, playerName }));

      await this.joinChannel(session.id, playerId, playerName);

      this.sendAction({ type: 'join', playerName, playerId });

      return { playerId };
    } catch (err) {
      store.dispatch(setSessionError('Failed to join session'));
      return null;
    }
  }

  private async joinChannel(sessionId: string, playerId: string, playerName: string) {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    this.channel = supabase.channel(`game:${sessionId}`, {
      config: { presence: { key: playerId } },
    });

    this.channel
      .on('broadcast', { event: 'game_action' }, (payload) => {
        this.handleRemoteAction(payload.payload as GameAction);
      })
      .on('broadcast', { event: 'state_sync' }, (payload) => {
        const session = store.getState().session;
        if (!session.isHost) {
          const { gameState, worldState } = payload.payload as {
            gameState: GameState;
            worldState: WorldState;
          };
          store.dispatch(syncGameState(gameState));
          store.dispatch(syncWorldState(worldState));
        }
      })
      .on('broadcast', { event: 'host_migration' }, (payload) => {
        const { newHostId } = payload.payload as { newHostId: string };
        store.dispatch(promoteToHost(newHostId));
        const session = store.getState().session;
        if (session.isHost) {
          this.startHostLoop();
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: PresenceState) => {
          store.dispatch(addConnectedPlayer(p.playerId));
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: PresenceState) => {
          store.dispatch(removeConnectedPlayer(p.playerId));
          this.handlePlayerDisconnect(p.playerId);
        });
      });

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        store.dispatch(setConnectionStatus('connected'));
        await this.channel!.track({ playerId, playerName });
      } else if (status === 'CHANNEL_ERROR') {
        store.dispatch(setConnectionStatus('error'));
      }
    });
  }

  private handleRemoteAction(action: GameAction) {
    const session = store.getState().session;

    if (!session.isHost) return;

    const tiles = store.getState().world.tiles;

    switch (action.type) {
      case 'join':
        store.dispatch(joinGame({ playerName: action.playerName }));
        {
          const gameState = store.getState().game;
          const newPlayer = gameState.players.find(p => p.name === action.playerName);
          if (newPlayer) {
            this.broadcastStateSync();
          }
        }
        this.updateSessionPlayerCount();
        break;

      case 'leave':
        store.dispatch(leaveGame({ playerId: action.playerId }));
        this.broadcastStateSync();
        this.updateSessionPlayerCount();
        break;

      case 'ready':
        store.dispatch(togglePlayerReady({ playerId: action.playerId }));
        this.broadcastStateSync();
        break;

      case 'start':
        store.dispatch(startGame());
        this.broadcastStateSync();
        this.startHostLoop();
        break;

      case 'move':
        store.dispatch(movePlayer({
          playerId: action.playerId,
          target: action.target,
          tiles,
        }));
        this.broadcastStateSync();
        break;

      case 'harvest':
        store.dispatch(harvestFromTile(action.payload));
        this.broadcastStateSync();
        break;

      case 'craft':
        store.dispatch(craftItem({ playerId: action.playerId, itemId: action.itemId }));
        this.broadcastStateSync();
        break;

      case 'useItem':
        if (action.itemId === 'terraform') {
          store.dispatch(applyTerraformItem(action.playerId) as never);
        } else if (action.itemId === 'leech') {
          store.dispatch(applyLeechItem(action.playerId) as never);
        } else {
          store.dispatch(activateItemEffect({ playerId: action.playerId, itemId: action.itemId }));
        }
        this.broadcastStateSync();
        break;

      case 'proposeTrade':
        store.dispatch(proposeTrade(action.payload));
        this.broadcastStateSync();
        break;

      case 'acceptTrade':
        store.dispatch(acceptTrade(action.payload));
        this.broadcastStateSync();
        break;

      case 'rejectTrade':
        store.dispatch(rejectTrade(action.payload));
        this.broadcastStateSync();
        break;

      case 'cancelTrade':
        store.dispatch(cancelTrade(action.payload));
        this.broadcastStateSync();
        break;

      case 'forceNextPhase':
        store.dispatch(forceNextPhase());
        this.broadcastStateSync();
        break;

      case 'endGame':
        store.dispatch(endGame());
        this.broadcastStateSync();
        this.stopHostLoop();
        break;
    }
  }

  sendAction(action: GameAction) {
    const session = store.getState().session;

    if (session.isHost) {
      this.handleRemoteAction(action);
      return;
    }

    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'game_action',
      payload: action,
    });
  }

  private broadcastStateSync() {
    if (!this.channel) return;

    const state = store.getState();

    this.channel.send({
      type: 'broadcast',
      event: 'state_sync',
      payload: {
        gameState: state.game,
        worldState: state.world,
      },
    });
  }

  startHostLoop() {
    this.stopHostLoop();

    this.phaseInterval = setInterval(() => {
      const state = store.getState();
      if (state.game.gameMode !== 'playing') {
        this.stopHostLoop();
        return;
      }
      store.dispatch(updatePhaseTimer({ tiles: state.world.tiles }));
      this.broadcastStateSync();
    }, 1000);
  }

  stopHostLoop() {
    if (this.phaseInterval) {
      clearInterval(this.phaseInterval);
      this.phaseInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private handlePlayerDisconnect(playerId: string) {
    const session = store.getState().session;

    if (session.isHost && playerId !== session.localPlayerId) {
      const gamePlayer = store.getState().game.players.find(p => p.id === playerId);
      if (gamePlayer) {
        store.dispatch(leaveGame({ playerId }));
        this.broadcastStateSync();
        this.updateSessionPlayerCount();
      }
    }

    if (playerId === session.hostPlayerId && !session.isHost) {
      const connectedIds = session.connectedPlayerIds.filter(id => id !== playerId);
      if (connectedIds.length > 0 && session.localPlayerId) {
        const sortedIds = [...connectedIds].sort();
        const newHostId = sortedIds[0];

        if (newHostId === session.localPlayerId) {
          store.dispatch(promoteToHost(newHostId));
          this.channel?.send({
            type: 'broadcast',
            event: 'host_migration',
            payload: { newHostId },
          });

          if (store.getState().game.gameMode === 'playing') {
            this.startHostLoop();
          }
        }
      }
    }
  }

  private async updateSessionPlayerCount() {
    if (!this.sessionId) return;
    const playerCount = store.getState().game.players.length;

    await supabase
      .from('game_sessions')
      .update({ player_count: playerCount, updated_at: new Date().toISOString() })
      .eq('id', this.sessionId);
  }

  async disconnect() {
    this.stopHostLoop();

    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.sessionId) {
      const session = store.getState().session;
      if (session.isHost) {
        await supabase
          .from('game_sessions')
          .update({ game_mode: 'ended', updated_at: new Date().toISOString() })
          .eq('id', this.sessionId);
      }
    }

    this.sessionId = null;
    store.dispatch(clearSession());
  }
}

export const realtimeService = new RealtimeService();

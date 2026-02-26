import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SessionState {
  sessionId: string | null;
  sessionCode: string | null;
  hostPlayerId: string | null;
  localPlayerId: string | null;
  localPlayerName: string | null;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
  connectedPlayerIds: string[];
  error: string | null;
}

const initialState: SessionState = {
  sessionId: null,
  sessionCode: null,
  hostPlayerId: null,
  localPlayerId: null,
  localPlayerName: null,
  isHost: false,
  connectionStatus: 'disconnected',
  connectedPlayerIds: [],
  error: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<{
      sessionId: string;
      sessionCode: string;
      hostPlayerId: string;
      isHost: boolean;
    }>) => {
      state.sessionId = action.payload.sessionId;
      state.sessionCode = action.payload.sessionCode;
      state.hostPlayerId = action.payload.hostPlayerId;
      state.isHost = action.payload.isHost;
      state.error = null;
    },

    setLocalPlayer: (state, action: PayloadAction<{ playerId: string; playerName: string }>) => {
      state.localPlayerId = action.payload.playerId;
      state.localPlayerName = action.payload.playerName;
    },

    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
    },

    setConnectedPlayers: (state, action: PayloadAction<string[]>) => {
      state.connectedPlayerIds = action.payload;
    },

    addConnectedPlayer: (state, action: PayloadAction<string>) => {
      if (!state.connectedPlayerIds.includes(action.payload)) {
        state.connectedPlayerIds.push(action.payload);
      }
    },

    removeConnectedPlayer: (state, action: PayloadAction<string>) => {
      state.connectedPlayerIds = state.connectedPlayerIds.filter(id => id !== action.payload);
    },

    promoteToHost: (state, action: PayloadAction<string>) => {
      state.hostPlayerId = action.payload;
      state.isHost = action.payload === state.localPlayerId;
    },

    setSessionError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.connectionStatus = 'error';
    },

    clearSession: () => initialState,
  },
});

export const {
  setSession,
  setLocalPlayer,
  setConnectionStatus,
  setConnectedPlayers,
  addConnectedPlayer,
  removeConnectedPlayer,
  promoteToHost,
  setSessionError,
  clearSession,
} = sessionSlice.actions;

export default sessionSlice.reducer;

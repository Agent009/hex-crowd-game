import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import worldReducer from './worldSlice';
import uiReducer from './uiSlice';
import sessionReducer from './sessionSlice';
import authReducer from './authSlice';
import { listenerMiddleware } from './listenerMiddleware';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    world: worldReducer,
    ui: uiReducer,
    session: sessionReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

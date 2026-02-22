import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import worldReducer from './worldSlice';
import uiReducer from './uiSlice';
import { listenerMiddleware } from './listenerMiddleware';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    world: worldReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

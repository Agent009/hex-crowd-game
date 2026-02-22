import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState } from './types';

const initialState: UIState = {
  showGrid: true,
  cameraPosition: { x: 0, y: 0 },
  zoomLevel: 1,
  showPlayerNumbers: true,
  showTileInfo: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCameraPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.cameraPosition = action.payload;
    },

    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.zoomLevel = Math.max(0.5, Math.min(2, action.payload));
    },

    toggleGrid: (state) => {
      state.showGrid = !state.showGrid;
    },

    togglePlayerNumbers: (state) => {
      state.showPlayerNumbers = !state.showPlayerNumbers;
    },

    toggleTileInfo: (state) => {
      state.showTileInfo = !state.showTileInfo;
    },
  },
});

export const {
  setCameraPosition,
  setZoomLevel,
  toggleGrid,
  togglePlayerNumbers,
  toggleTileInfo,
} = uiSlice.actions;
export default uiSlice.reducer;

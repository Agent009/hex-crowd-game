import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CubeCoords, HexTile, coordsToKey, generateHexSpiral } from '../utils/hexGrid';
import {
  gameSize,
  predefinedTerrain,
  TerrainType
} from '../data/gameData';
import { WorldState } from './types';

const generatePartyGameWorld = (size: number): { [key: string]: HexTile } => {
  const tiles: { [key: string]: HexTile } = {};
  const center: CubeCoords = { q: 0, r: 0, s: 0 };
  const coords = generateHexSpiral(center, size);

  coords.forEach(coord => {
    const key = coordsToKey(coord);
    const terrain: TerrainType = predefinedTerrain[key] || 'plains';
    tiles[key] = {
      coords: coord,
      terrain,
      explored: true,
      visible: true,
      fogLevel: 2,
      isActive: true,
    };
  });

  return tiles;
};

const generatedWorld = generatePartyGameWorld(gameSize);

const initialState: WorldState = {
  tiles: generatedWorld,
  worldSize: gameSize,
  selectedTile: null,
  activeTiles: Object.keys(generatedWorld),
};

const worldSlice = createSlice({
  name: 'world',
  initialState,
  reducers: {
    selectTile: (state, action: PayloadAction<CubeCoords>) => {
      state.selectedTile = action.payload;
    },

    deselectTile: (state) => {
      state.selectedTile = null;
    },

    deactivateTile: (state, action: PayloadAction<string>) => {
      const tileKey = action.payload;
      const idx = state.activeTiles.indexOf(tileKey);
      if (idx > -1) {
        state.activeTiles.splice(idx, 1);
      }
      if (state.tiles[tileKey]) {
        state.tiles[tileKey].isActive = false;
      }
    },

    setTilePlayers: (state, action: PayloadAction<{ tileKey: string; players: import('../data/gameData').Player[] }>) => {
      const { tileKey, players } = action.payload;
      if (state.tiles[tileKey]) {
        state.tiles[tileKey].players = players;
      }
    },
  },
});

export const { selectTile, deselectTile, deactivateTile, setTilePlayers } = worldSlice.actions;
export default worldSlice.reducer;

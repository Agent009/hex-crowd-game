import { AppDispatch, RootState } from './store';
import { useItem } from './gameSlice';
import { activateTile, deactivateTile } from './worldSlice';
import { coordsToKey } from '../utils/hexGrid';

export const useTerraformItem = (playerId: string) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const tiles = state.world.tiles;
    const activeTiles = state.world.activeTiles;

    const inactiveTileKeys = Object.keys(tiles).filter(k => !activeTiles.includes(k));

    const shuffled = [...inactiveTileKeys].sort(() => Math.random() - 0.5);
    const toActivate = shuffled.slice(0, 3);

    dispatch(useItem({ playerId, itemId: 'terraform' }));
    toActivate.forEach(tileKey => dispatch(activateTile(tileKey)));
  };

export const useLeechItem = (playerId: string) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const player = state.game.players.find(p => p.id === playerId);
    const activeTiles = state.world.activeTiles;

    if (!player) return;

    const playerTileKey = coordsToKey(player.position);

    const eligibleTiles = activeTiles.filter(k => k !== playerTileKey);
    const shuffled = [...eligibleTiles].sort(() => Math.random() - 0.5);
    const toDeactivate = shuffled.slice(0, 2);

    dispatch(useItem({ playerId, itemId: 'leech' }));
    toDeactivate.forEach(tileKey => dispatch(deactivateTile(tileKey)));
  };

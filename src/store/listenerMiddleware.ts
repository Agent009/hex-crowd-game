import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { joinGame, leaveGame, movePlayer, harvestFromTile, updatePhaseTimer } from './gameSlice';
import { setTilePlayers, deactivateTile } from './worldSlice';
import { coordsToKey } from '../utils/hexGrid';
import type { Player } from '../data/gameData';
import type { HexTile } from '../utils/hexGrid';

export const listenerMiddleware = createListenerMiddleware();

type AppGetState = () => {
  game: { players: Player[] };
  world: {
    tiles: { [key: string]: HexTile };
    activeTiles: string[];
  };
};

const syncTilePlayers = (listenerApi: { getState: unknown; dispatch: (a: unknown) => void }) => {
  const getState = listenerApi.getState as AppGetState;
  const state = getState();
  const players = state.game.players;
  const tiles = state.world.tiles;

  const tilePlayerMap: { [key: string]: Player[] } = {};
  Object.keys(tiles).forEach(key => { tilePlayerMap[key] = []; });

  players.forEach(player => {
    const key = coordsToKey(player.position);
    if (key in tilePlayerMap) {
      tilePlayerMap[key].push(player);
    }
  });

  Object.entries(tilePlayerMap).forEach(([tileKey, tilePlayers]) => {
    const currentPlayers = tiles[tileKey]?.players ?? [];
    const currentIds = currentPlayers.map(p => p.id).sort().join(',');
    const newIds = tilePlayers.map(p => p.id).sort().join(',');
    if (currentIds !== newIds) {
      listenerApi.dispatch(setTilePlayers({ tileKey, players: tilePlayers }));
    }
  });
};

listenerMiddleware.startListening({
  matcher: isAnyOf(joinGame, leaveGame, movePlayer, updatePhaseTimer),
  effect: (_action, listenerApi) => {
    syncTilePlayers(listenerApi);
  }
});

listenerMiddleware.startListening({
  actionCreator: harvestFromTile,
  effect: (action, listenerApi) => {
    const { tileCoords, isItem } = action.payload;
    const tileKey = coordsToKey(tileCoords);

    const getState = listenerApi.getState as AppGetState;
    const { activeTiles } = getState().world;

    if (!isItem && activeTiles.includes(tileKey)) {
      const state = getState();
      const tileTerrain = state.world.tiles[tileKey]?.terrain;
      if (tileTerrain !== 'lake') {
        listenerApi.dispatch(deactivateTile(tileKey));
      }
    } else if (isItem && activeTiles.includes(tileKey)) {
      const state = getState();
      const tileTerrain = state.world.tiles[tileKey]?.terrain;
      if (tileTerrain !== 'lake') {
        listenerApi.dispatch(deactivateTile(tileKey));
      }
    }
  }
});

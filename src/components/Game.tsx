import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { GameCanvas } from './GameCanvas';
import { GameLobby } from './UI/GameLobby';
import { PartyGameHUD } from './UI/PartyGameHUD';
import { TileInfo } from './UI/TileInfo';
import { BoltLogo } from './UI/BoltLogo';

const GameContent: React.FC = () => {
  const { gameMode } = useSelector((state: RootState) => state.game);

  if (gameMode === 'lobby') {
    return <GameLobby />;
  }

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      {/* Bolt Logo */}
      <BoltLogo />

      {/* Main Game Canvas */}
      <GameCanvas className="absolute inset-0" />

      {/* UI Overlays */}
      <PartyGameHUD />
      <TileInfo />
      
      {/* Loading Screen */}
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-1000">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-white text-xl font-bold mb-2">Loading Heroes Kingdoms</h2>
          <p className="text-slate-400">Preparing the realm for conquest...</p>
        </div>
      </div>
    </div>
  );
};

export const Game: React.FC = () => {
  return (
    <Provider store={store}>
      <GameContent />
    </Provider>
  );
};

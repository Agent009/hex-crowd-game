import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './UI/GameHUD';
import { TileInfo } from './UI/TileInfo';
import { PanelManager } from './UI/PanelManager';

export const Game: React.FC = () => {
  return (
    <Provider store={store}>
      <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
        {/* Main Game Canvas */}
        <GameCanvas className="absolute inset-0" />

        {/* UI Overlays */}
        <GameHUD />
        <TileInfo />
        <PanelManager />
        
        {/* Loading Screen */}
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-1000">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-white text-xl font-bold mb-2">Loading Heroes Kingdoms</h2>
            <p className="text-slate-400">Preparing the realm for conquest...</p>
          </div>
        </div>
      </div>
    </Provider>
  );
};

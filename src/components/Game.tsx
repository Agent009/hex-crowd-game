import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { GameLobby } from './UI/GameLobby';
import { PartyGameHUD } from './UI/PartyGameHUD';
import { TileInfo } from './UI/TileInfo';
import { BoltLogo } from './UI/BoltLogo';
import { VictoryScreen } from './UI/VictoryScreen';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const GameCanvas = React.lazy(() =>
  import('./GameCanvas').then(module => ({ default: module.GameCanvas }))
);

interface CanvasBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends React.Component<React.PropsWithChildren, CanvasBoundaryState> {
  state: CanvasBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Game canvas failed:', error);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        data-testid="game-canvas-error"
        className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white"
        role="alert"
      >
        <div className="mx-6 max-w-md rounded-lg border border-red-500/40 bg-slate-900/95 p-6 text-center shadow-2xl">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-300" />
          <h2 className="mb-2 text-xl font-bold">Canvas failed to load</h2>
          <p className="mb-5 text-sm text-slate-300">
            The board renderer hit a recoverable problem.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }
}

const CanvasLoadingFallback = () => (
  <div
    data-testid="game-canvas-loading"
    className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white"
    role="status"
    aria-live="polite"
  >
    <div className="text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
      <div className="text-sm font-semibold tracking-wide text-slate-200">Loading board</div>
    </div>
  </div>
);

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
      <CanvasErrorBoundary>
        <React.Suspense fallback={<CanvasLoadingFallback />}>
          <GameCanvas className="absolute inset-0" />
        </React.Suspense>
      </CanvasErrorBoundary>

      {/* UI Overlays */}
      <PartyGameHUD />
      <TileInfo />

      {/* Victory Screen */}
      {gameMode === 'ended' && <VictoryScreen />}

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

import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { updateGameTimer, nextRound, endGame, toggleGrid, togglePlayerNumbers, setCurrentPlayer } from '../../store/gameSlice';
import { isTestMode } from '../../data/gameData';
import { HarvestGrid } from './HarvestGrid';
import { StatusEffectsDisplay, PlayerStatusBar } from './StatusEffectsDisplay';
import { NotificationSystem } from './NotificationSystem';
import {
  Users,
  Trophy,
  Timer,
  Grid3X3,
  Eye,
  EyeOff,
  Crown,
  Play,
  Pause,
  Package,
  TestTube,
  UserCheck
} from 'lucide-react';

export const PartyGameHUD: React.FC = () => {
  const dispatch = useDispatch();
  const {
    players,
    teams,
    currentPlayer,
    gameMode,
    gameTimer,
    roundNumber,
    showGrid,
    showPlayerNumbers,
    playerStats
  } = useSelector((state: RootState) => state.game);

  const [isGamePaused, setIsGamePaused] = useState(false);
  const [showHarvestGrid, setShowHarvestGrid] = useState(false);
  const [showTestControls, setShowTestControls] = useState(false);

  // Game timer effect
  useEffect(() => {
    if (gameMode === 'playing' && !isGamePaused) {
      const interval = setInterval(() => {
        dispatch(updateGameTimer(gameTimer + 1));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameMode, gameTimer, isGamePaused, dispatch]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndGame = () => {
    dispatch(endGame());
  };

  const togglePause = () => {
    setIsGamePaused(!isGamePaused);
  };

  const handlePlayerSelect = (playerId: string) => {
    dispatch(setCurrentPlayer({ playerId }));
  };

  // Get top teams by score
  const sortedTeams = [...teams]
    .filter(team => team.playerIds.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (gameMode !== 'playing') {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-slate-800 to-slate-700 shadow-lg border-b border-slate-600">
      <div className="flex items-center justify-between p-4">
        {/* Game Info */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Crown className="w-6 h-6 text-yellow-400" />
            <div>
              <div className="text-white font-bold text-lg">Round {roundNumber}</div>
              <div className="text-slate-300 text-sm">Party Game</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Timer className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-white font-bold">{formatTime(gameTimer)}</div>
              <div className="text-slate-400 text-xs">Game Time</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-green-400" />
            <div>
              <div className="text-white font-bold">{players.length}</div>
              <div className="text-slate-400 text-xs">Players</div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="flex items-center space-x-4">
          <div className="text-slate-300 text-sm font-medium">Top Teams:</div>
          {sortedTeams.map((team, index) => (
            <div key={team.id} className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Trophy 
                  className={`w-4 h-4 ${
                    index === 0 ? 'text-yellow-400' : 
                    index === 1 ? 'text-gray-400' : 
                    'text-amber-600'
                  }`} 
                />
                <span className="text-white text-sm font-semibold">#{index + 1}</span>
              </div>
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-white text-sm">{team.name}</span>
              <span className="text-slate-300 text-sm">({team.score})</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => dispatch(toggleGrid())}
            className={`p-2 rounded-lg transition-colors ${
              showGrid 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
            }`}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-5 h-5" />
          </button>

          <button
            onClick={() => dispatch(togglePlayerNumbers())}
            className={`p-2 rounded-lg transition-colors ${
              showPlayerNumbers 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
            }`}
            title="Toggle Player Numbers"
          >
            {showPlayerNumbers ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowHarvestGrid(!showHarvestGrid)}
            className={`p-2 rounded-lg transition-colors ${
              showHarvestGrid 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
            }`}
            title="Toggle Harvest Grid"
          >
            <Package className="w-5 h-5" />
          </button>

          {isTestMode && (
            <button
              onClick={() => setShowTestControls(!showTestControls)}
              className={`p-2 rounded-lg transition-colors ${
                showTestControls 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
              }`}
              title="Test Mode Controls"
            >
              <TestTube className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={togglePause}
            className={`p-2 rounded-lg transition-colors ${
              isGamePaused 
                ? 'bg-green-600 text-white' 
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
            title={isGamePaused ? 'Resume Game' : 'Pause Game'}
          >
            {isGamePaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          <button
            onClick={() => dispatch(nextRound())}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
          >
            Next Round
          </button>

          <button
            onClick={handleEndGame}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
          >
            End Game
          </button>
        </div>
      </div>

      {/* Player Status Bar */}
      <div className="bg-slate-900 border-t border-slate-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400 text-sm">Active Players:</span>
            <div className="flex items-center space-x-2">
              {teams.filter(t => t.playerIds.length > 0).map(team => (
                <div key={team.id} className="flex items-center space-x-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="text-white text-sm">{team.playerIds.length}</span>
                </div>
              ))}
            </div>
          </div>

          {currentPlayer && (
            <div className="flex items-center space-x-2 bg-blue-900 px-3 py-1 rounded">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span className="text-blue-200 text-sm">
                Playing as: {currentPlayer.name} (#{currentPlayer.number})
              </span>
              {playerStats[currentPlayer.id] && (
                <span className="text-blue-300 text-sm">
                  • {playerStats[currentPlayer.id].actionPoints} AP
                </span>
              )}
            </div>
          )}

          {isGamePaused && (
            <div className="flex items-center space-x-2 bg-yellow-900 px-3 py-1 rounded">
              <Pause className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-200 text-sm font-medium">Game Paused</span>
            </div>
          )}
        </div>
      </div>

      {/* Harvest Grid */}
      {showHarvestGrid && <HarvestGrid />}

      {/* Status Effects Display */}
      <StatusEffectsDisplay />

      {/* Player Status Bar */}
      <PlayerStatusBar />

      {/* Notification System */}
      <NotificationSystem />

      {/* Test Mode Controls */}
      {isTestMode && showTestControls && (
        <div className="bg-orange-900 border-t border-orange-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-orange-200 font-semibold flex items-center">
              <TestTube className="w-4 h-4 mr-2" />
              Test Mode Controls
            </h3>
            <button
              onClick={() => setShowTestControls(false)}
              className="text-orange-400 hover:text-orange-300"
            >
              ×
            </button>
          </div>
          
          <div>
            <div className="text-orange-300 text-sm mb-2">Select Player to Control:</div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {players.map(player => (
                <button
                  key={player.id}
                  onClick={() => handlePlayerSelect(player.id)}
                  className={`p-2 rounded text-xs font-medium transition-colors ${
                    currentPlayer?.id === player.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-800 text-orange-200 hover:bg-orange-700'
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: '#DC2626' }}
                    >
                      <span className="text-white text-xs font-bold">
                        {player.number}
                      </span>
                    </div>
                    <span>{player.name}</span>
                  </div>
                  {playerStats[player.id] && (
                    <div className="text-xs opacity-75">
                      {playerStats[player.id].actionPoints} AP
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
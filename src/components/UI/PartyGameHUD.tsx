import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { nextRound, endGame, toggleGrid, togglePlayerNumbers, setCurrentPlayer, updatePhaseTimer, dismissPhaseOverlay, forceNextPhase, phaseOrder, GamePhase } from '../../store/gameSlice';
import { isTestMode } from '../../data/gameData';
import { HarvestGrid } from './HarvestGrid';
import { StatusEffectsDisplay, PlayerStatusBar } from './StatusEffectsDisplay';
import { NotificationSystem } from './NotificationSystem';
import { HexActionMenu } from './HexActionMenu';
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
    playerStats,
    currentPhase,
    phaseTimer
  } = useSelector((state: RootState) => state.game);

  const [isGamePaused, setIsGamePaused] = useState(false);
  const [showHarvestGrid, setShowHarvestGrid] = useState(false);
  const [showTestControls, setShowTestControls] = useState(false);
  const [showTeamScores, setShowTeamScores] = useState(false);
  const [harvestGridTab, setHarvestGridTab] = useState<'resources' | 'items' | 'crafting'>('resources');

  // Phase timer effect
  useEffect(() => {
    if (gameMode === 'playing' && !isGamePaused) {
      const interval = setInterval(() => {
        dispatch(updatePhaseTimer());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameMode, isGamePaused, dispatch]);

  const formatPhaseTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseDisplayName = (phase: GamePhase): string => {
    switch (phase) {
      case 'round_start': return 'Round Start';
      case 'ap_renewal': return 'AP Renewal';
      case 'interaction': return 'Interaction Phase';
      case 'bartering': return 'Bartering Phase';
      case 'terrain_effects': return 'Terrain Effects';
      case 'disaster_check': return 'Disaster Check';
      case 'elimination': return 'Elimination Phase';
      default: return phase;
    }
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

  const handleOpenHarvestGrid = (tab: 'resources' | 'items' | 'crafting') => {
    setHarvestGridTab(tab);
    setShowHarvestGrid(true);
  };

  const handleOpenTileInfo = () => {
    // Tile info is always visible, this could scroll to it or highlight it
    console.log('Open tile info');
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
        {/* Game Info - Left Side */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Crown className="w-6 h-6 text-yellow-400" />
            <div>
              <div className="text-white font-bold text-lg">Round {roundNumber}</div>
              <div className="text-slate-300 text-sm">{getPhaseDisplayName(currentPhase)}</div>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="flex items-center space-x-1 text-blue-400 font-bold">
              <Timer className="w-4 h-4" />
              <span>{formatPhaseTime(phaseTimer)}</span>
            </div>

            {/* Phase Progress Dots */}
            <div>
              <div className="flex space-x-1">
                {phaseOrder.map((phase, index) => {
                  const currentIndex = phaseOrder.indexOf(currentPhase);
                  const isCompleted = index < currentIndex;
                  const isActive = index === currentIndex;
                  const isUpcoming = index > currentIndex;

                  return (
                    <div
                      key={phase}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-green-500' 
                          : isActive 
                            ? 'bg-blue-500 ring-2 ring-blue-300 ring-opacity-50' 
                            : 'bg-gray-600'
                      }`}
                      title={getPhaseDisplayName(phase)}
                    />
                  );
                })}
              </div>
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

        {/* Center - Player Status */}
        <div className="flex items-center space-x-4">
          {currentPlayer && currentPlayerStats && (
            <div className="flex items-center space-x-3 bg-slate-900 px-4 py-2 rounded-lg border border-slate-600">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                currentPlayerStats.hp <= 0 ? 'bg-red-800' : 'bg-red-600'
              }`}>
                {currentPlayer.number}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{currentPlayer.name}</div>
                <div className="text-slate-400 text-xs">Player #{currentPlayer.number}</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Heart className={`w-4 h-4 ${currentPlayerStats.hp <= 3 ? 'text-red-400' : 'text-red-500'}`} />
                  <span className={`text-sm font-bold ${currentPlayerStats.hp <= 3 ? 'text-red-400' : 'text-white'}`}>
                    {currentPlayerStats.hp}/10
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-white text-sm font-bold">
                    {currentPlayerStats.actionPoints}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Team Scores Button */}
          <button
            onClick={() => setShowTeamScores(!showTeamScores)}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 transition-colors"
            title="View Team Scores"
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm">Scores</span>
          </button>
        </div>

        {/* Controls - Right Side */}
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

      {/* Team Scores Popup */}
      {showTeamScores && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-slate-800 rounded-lg shadow-xl border border-slate-600 p-4 z-60 min-w-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center">
              <Trophy className="w-4 h-4 mr-2 text-yellow-400" />
              Team Leaderboard
            </h3>
            <button
              onClick={() => setShowTeamScores(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {sortedTeams.map((team, index) => (
              <div key={team.id} className="flex items-center justify-between bg-slate-700 p-2 rounded">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300">#{index + 1}</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="text-white">{team.name}</span>
                </div>
                <span className="text-slate-300 font-semibold">{team.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

          {isGamePaused && (
            <div className="flex items-center space-x-2 bg-yellow-900 px-3 py-1 rounded">
              <Pause className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-200 text-sm font-medium">Game Paused</span>
            </div>
          )}
        </div>
      </div>

      {/* Harvest Grid */}
      {showHarvestGrid && (
        <HarvestGrid
          initialTab={harvestGridTab}
          onClose={() => setShowHarvestGrid(false)}
        />
      )}

      {/* Hex Action Menu */}
      <HexActionMenu
        onOpenHarvestGrid={handleOpenHarvestGrid}
        onOpenTileInfo={handleOpenTileInfo}
      />

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
                    />
                    <span className="text-white text-xs font-bold">
                      {player.number}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isTestMode && (
            <button
              onClick={() => dispatch(forceNextPhase())}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              Next Phase
            </button>
          )}

          {isTestMode && (
            <button
              onClick={handleEndGame}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              End Game
            </button>
          )}
        </div>
      )}
    </div>
  );
};
import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { joinGame, leaveGame, togglePlayerReady, startGame } from '../../store/gameSlice';
import { requiredTeams, requiredPlayersPerTeam, isTestMode } from '../../data/gameData';
import {
  Users,
  Play,
  UserPlus,
  UserMinus,
  Check,
  X,
  Crown,
  Timer,
  Trophy,
  TestTube
} from 'lucide-react';

export const GameLobby: React.FC = () => {
  const dispatch = useDispatch();
  const { players, teams, gameMode, currentPlayer } = useSelector((state: RootState) => state.game);
  const [playerName, setPlayerName] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const handleJoinGame = () => {
    if (playerName.trim()) {
      dispatch(joinGame({ playerName: playerName.trim() }));
      setPlayerName('');
      setShowJoinForm(false);
    }
  };

  const handleLeaveGame = (playerId: string) => {
    dispatch(leaveGame({ playerId }));
  };

  const handleToggleReady = (playerId: string) => {
    dispatch(togglePlayerReady({ playerId }));
  };

  const handleStartGame = () => {
    dispatch(startGame());
  };

  // Check game start requirements
  const teamsWithEnoughPlayers = teams.filter(t => t.playerIds.length >= requiredPlayersPerTeam);
  const hasRequiredTeams = teamsWithEnoughPlayers.length >= requiredTeams;
  const allPlayersReady = players.every(p => p.isReady);

  // In test mode, allow starting with fewer requirements
  const canStartGame = isTestMode
    ? (players.length >= 2 && allPlayersReady)
    : (hasRequiredTeams && allPlayersReady);

  const getStartGameMessage = () => {
    if (isTestMode) {
      if (players.length < 2) return 'Need at least 2 players to start (Test Mode)';
      if (!allPlayersReady) return 'All players must be ready to start';
      return '';
    } else {
      if (!hasRequiredTeams) return `Need ${requiredTeams} teams with ${requiredPlayersPerTeam} players each`;
      if (!allPlayersReady) return 'All players must be ready to start';
      return '';
    }
  };

  if (gameMode !== 'lobby') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 overflow-y-auto">
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center">
              <Crown className="w-10 h-10 mr-3 text-yellow-400" />
              Heroes Kingdoms Party Game
              {isTestMode && (
                <TestTube className="w-6 h-6 ml-3 text-orange-400" title="Test Mode Active" />
              )}
            </h1>
            <p className="text-slate-300 text-lg">
              Real-time competitive board game for up to 30 players in {requiredTeams} teams
            </p>
            {isTestMode && (
              <div className="mt-2 bg-orange-900 bg-opacity-50 border border-orange-600 rounded-lg p-3">
                <div className="flex items-center justify-center space-x-2">
                  <TestTube className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-200 text-sm font-medium">
                    Test Mode: Players auto-ready, relaxed start requirements
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Game Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{players.length}/30</div>
              <div className="text-slate-400">Players</div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <Trophy className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">
                {teams.filter(t => t.playerIds.length >= requiredPlayersPerTeam).length}/{requiredTeams}
              </div>
              <div className="text-slate-400">Active Teams</div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <Timer className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">91</div>
              <div className="text-slate-400">Hex Tiles</div>
            </div>
          </div>

          {/* Join Game Section */}
          <div className="bg-slate-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-green-400" />
              Join Game
            </h2>

            {!showJoinForm ? (
              <button
                onClick={() => setShowJoinForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center"
                disabled={players.length >= 30}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                {players.length >= 30 ? 'Game Full' : 'Join Game'}
              </button>
            ) : (
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  maxLength={20}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                />
                <button
                  onClick={handleJoinGame}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  disabled={!playerName.trim()}
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setShowJoinForm(false);
                    setPlayerName('');
                  }}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Teams and Players */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {teams.map(team => {
              const teamPlayers = players.filter(p => p.teamId === team.id);

              return (
                <div key={team.id} className="bg-slate-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </h3>
                    <span className="text-slate-400 text-sm">
                      {teamPlayers.length}/{requiredPlayersPerTeam} players
                    </span>
                  </div>

                  <div className="space-y-2">
                    {teamPlayers.map(player => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-slate-700 rounded-lg p-3"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: '#DC2626' }}
                          >
                            {player.number}
                          </div>
                          <span className="text-white font-medium">{player.name}</span>
                          {player.isReady && (
                            <Check className="w-4 h-4 text-green-400" />
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {currentPlayer?.id === player.id && (
                            <button
                              onClick={() => handleToggleReady(player.id)}
                              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                player.isReady 
                                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {player.isReady ? 'Ready' : 'Not Ready'}
                            </button>
                          )}

                          {currentPlayer?.id === player.id && (
                            <button
                              onClick={() => handleLeaveGame(player.id)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {teamPlayers.length === 0 && (
                      <div className="text-slate-500 text-center py-4 italic">
                        No players in this team
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Game */}
          {players.length > 0 && (
            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <h3 className="text-lg font-bold text-white mb-4">Ready to Start?</h3>

              <div className="mb-4">
                <div className="text-slate-300 mb-2">
                  {players.filter(p => p.isReady).length}/{players.length} players ready
                  {!isTestMode && (
                    <span className="ml-4 text-slate-400">
                      ({teamsWithEnoughPlayers.length}/{requiredTeams} teams ready)
                    </span>
                  )}
                </div>

                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(players.filter(p => p.isReady).length / Math.max(players.length, 1)) * 100}%`
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={!canStartGame}
                className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors flex items-center mx-auto ${
                  canStartGame
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-6 h-6 mr-2" />
                Start Game
              </button>

              {!canStartGame && (
                <p className="text-slate-400 text-sm mt-2">
                  {getStartGameMessage()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { joinGame, leaveGame, togglePlayerReady, startGame } from '../../store/gameSlice';
import { requiredTeams, requiredPlayersPerTeam, isTestMode } from '../../data/gameData';
import { useMultiplayer } from '../../hooks/useMultiplayer';
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
  TestTube,
  Wifi,
  WifiOff,
  Copy,
  LogIn,
  Loader2,
  Globe,
} from 'lucide-react';

type LobbyView = 'menu' | 'creating' | 'joining' | 'session';

export const GameLobby: React.FC = () => {
  const dispatch = useDispatch();
  const { players, teams, gameMode } = useSelector((state: RootState) => state.game);
  const session = useSelector((state: RootState) => state.session);
  const {
    isMultiplayer,
    isHost,
    localPlayerId,
    createSession,
    joinSession,
    disconnect,
    sendReady,
    sendStart,
  } = useMultiplayer();

  const [lobbyView, setLobbyView] = useState<LobbyView>('menu');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [showLocalJoinForm, setShowLocalJoinForm] = useState(false);
  const [localPlayerName, setLocalPlayerName] = useState('');

  const handleCreateSession = async () => {
    if (!playerName.trim()) return;
    setIsLoading(true);
    const result = await createSession(playerName.trim());
    setIsLoading(false);
    if (result) {
      setLobbyView('session');
    }
  };

  const handleJoinSession = async () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setIsLoading(true);
    const result = await joinSession(joinCode.trim(), playerName.trim());
    setIsLoading(false);
    if (result) {
      setLobbyView('session');
    }
  };

  const handleCopyCode = () => {
    if (session.sessionCode) {
      navigator.clipboard.writeText(session.sessionCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setLobbyView('menu');
    setPlayerName('');
    setJoinCode('');
  };

  const handleToggleReady = (playerId: string) => {
    if (isMultiplayer) {
      sendReady(playerId);
    } else {
      dispatch(togglePlayerReady({ playerId }));
    }
  };

  const handleStartGame = () => {
    if (isMultiplayer) {
      sendStart();
    } else {
      dispatch(startGame());
    }
  };

  const handleLocalJoinGame = () => {
    if (localPlayerName.trim()) {
      dispatch(joinGame({ playerName: localPlayerName.trim() }));
      setLocalPlayerName('');
      setShowLocalJoinForm(false);
    }
  };

  const handleLeaveGame = (playerId: string) => {
    dispatch(leaveGame({ playerId }));
  };

  const teamsWithEnoughPlayers = teams.filter(t => t.playerIds.length >= requiredPlayersPerTeam);
  const hasRequiredTeams = teamsWithEnoughPlayers.length >= requiredTeams;
  const allPlayersReady = players.length > 0 && players.every(p => p.isReady);

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

  const localPlayer = players.find(p => p.id === localPlayerId) || players.find(p => p.name === session.localPlayerName);

  if (gameMode !== 'lobby') return null;

  if (lobbyView === 'menu') {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
        <div className="max-w-lg w-full mx-6">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold text-white mb-3 flex items-center justify-center">
              <Crown className="w-12 h-12 mr-3 text-yellow-400" />
              HEX Golems
            </h1>
            <p className="text-slate-400 text-lg">Competitive hex board game for up to 30 players</p>
            {isTestMode && (
              <div className="mt-3 inline-flex items-center space-x-1 bg-amber-900/50 border border-amber-700 rounded-full px-3 py-1">
                <TestTube className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 text-xs font-medium">Test Mode</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setLobbyView('creating')}
              className="w-full flex items-center justify-center space-x-3 bg-green-600 hover:bg-green-500 text-white rounded-xl px-6 py-4 font-semibold text-lg transition-colors"
            >
              <Globe className="w-6 h-6" />
              <span>Create Online Game</span>
            </button>

            <button
              onClick={() => setLobbyView('joining')}
              className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-4 font-semibold text-lg transition-colors"
            >
              <LogIn className="w-6 h-6" />
              <span>Join Online Game</span>
            </button>

            <div className="relative flex items-center my-6">
              <div className="flex-1 border-t border-slate-700" />
              <span className="px-4 text-slate-500 text-sm">or</span>
              <div className="flex-1 border-t border-slate-700" />
            </div>

            <button
              onClick={() => setLobbyView('session')}
              className="w-full flex items-center justify-center space-x-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-6 py-4 font-semibold text-lg transition-colors"
            >
              <Users className="w-6 h-6" />
              <span>Local Game (Same Device)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (lobbyView === 'creating') {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-6">
          <button
            onClick={() => setLobbyView('menu')}
            className="text-slate-400 hover:text-white mb-6 flex items-center transition-colors"
          >
            <X className="w-4 h-4 mr-1" /> Back
          </button>

          <h2 className="text-3xl font-bold text-white mb-2">Create Game</h2>
          <p className="text-slate-400 mb-8">Start a new session and share the code with friends</p>

          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none text-lg"
                maxLength={20}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              />
            </div>

            {session.error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {session.error}
              </div>
            )}

            <button
              onClick={handleCreateSession}
              disabled={!playerName.trim() || isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg px-6 py-3 font-semibold transition-colors"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Creating...</span></>
              ) : (
                <><Globe className="w-5 h-5" /><span>Create Session</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (lobbyView === 'joining') {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-6">
          <button
            onClick={() => setLobbyView('menu')}
            className="text-slate-400 hover:text-white mb-6 flex items-center transition-colors"
          >
            <X className="w-4 h-4 mr-1" /> Back
          </button>

          <h2 className="text-3xl font-bold text-white mb-2">Join Game</h2>
          <p className="text-slate-400 mb-8">Enter the session code shared by the host</p>

          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-lg"
                maxLength={20}
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm mb-2 block">Session Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-lg tracking-[0.3em] text-center font-mono"
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              />
            </div>

            {session.error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {session.error}
              </div>
            )}

            <button
              onClick={handleJoinSession}
              disabled={!playerName.trim() || joinCode.length < 6 || isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg px-6 py-3 font-semibold transition-colors"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Joining...</span></>
              ) : (
                <><LogIn className="w-5 h-5" /><span>Join Session</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 overflow-y-auto">
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center">
              <Crown className="w-10 h-10 mr-3 text-yellow-400" />
              HEX Golems
              {isTestMode && (
                <span title="Test Mode Active"><TestTube className="w-6 h-6 ml-3 text-orange-400" /></span>
              )}
            </h1>
            <p className="text-slate-300 text-lg">
              {isMultiplayer ? 'Online Multiplayer' : 'Local Game'} -- Up to 30 players in {requiredTeams} teams
            </p>
          </div>

          {/* Session Info Bar */}
          {isMultiplayer && session.sessionCode && (
            <div className="bg-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-700">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {session.connectionStatus === 'connected' ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-slate-300 text-sm capitalize">{session.connectionStatus}</span>
                </div>
                {isHost && (
                  <span className="bg-amber-700 text-amber-100 text-xs font-semibold px-2 py-1 rounded">HOST</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-slate-400 text-sm">Session Code:</span>
                <span className="font-mono text-2xl font-bold text-white tracking-[0.2em] bg-slate-700 px-4 py-1 rounded-lg">
                  {session.sessionCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  title="Copy code"
                >
                  {codeCopied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-300" />
                  )}
                </button>
              </div>

              <button
                onClick={handleDisconnect}
                className="text-red-400 hover:text-red-300 text-sm flex items-center space-x-1 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Leave</span>
              </button>
            </div>
          )}

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
              <Timer className="w-8 h-8 text-teal-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">91</div>
              <div className="text-slate-400">Hex Tiles</div>
            </div>
          </div>

          {/* Join Game Section (Local mode only) */}
          {!isMultiplayer && (
            <div className="bg-slate-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-green-400" />
                Add Local Player
              </h2>

              {!showLocalJoinForm ? (
                <button
                  onClick={() => setShowLocalJoinForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center"
                  disabled={players.length >= 30}
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  {players.length >= 30 ? 'Game Full' : 'Add Player'}
                </button>
              ) : (
                <div className="flex items-center space-x-4">
                  <input
                    type="text"
                    value={localPlayerName}
                    onChange={(e) => setLocalPlayerName(e.target.value)}
                    placeholder="Enter player name"
                    className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                    maxLength={20}
                    onKeyDown={(e) => e.key === 'Enter' && handleLocalJoinGame()}
                  />
                  <button
                    onClick={handleLocalJoinGame}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    disabled={!localPlayerName.trim()}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setShowLocalJoinForm(false);
                      setLocalPlayerName('');
                    }}
                    className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

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
                    {teamPlayers.map(player => {
                      const isLocalPlayer = isMultiplayer
                        ? (player.id === localPlayer?.id)
                        : true;

                      return (
                        <div
                          key={player.id}
                          className={`flex items-center justify-between rounded-lg p-3 ${
                            player.id === localPlayer?.id && isMultiplayer
                              ? 'bg-slate-600 border border-slate-500'
                              : 'bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: team.color }}
                            >
                              {player.number}
                            </div>
                            <span className="text-white font-medium">{player.name}</span>
                            {player.id === localPlayer?.id && isMultiplayer && (
                              <span className="text-xs text-slate-400">(you)</span>
                            )}
                            {player.isReady && (
                              <Check className="w-4 h-4 text-green-400" />
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            {isLocalPlayer && (
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

                            {!isMultiplayer && (
                              <button
                                onClick={() => handleLeaveGame(player.id)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

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

              {(isHost || !isMultiplayer) ? (
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
              ) : (
                <p className="text-slate-400 text-sm">Waiting for host to start the game...</p>
              )}

              {!canStartGame && (isHost || !isMultiplayer) && (
                <p className="text-slate-400 text-sm mt-2">
                  {getStartGameMessage()}
                </p>
              )}
            </div>
          )}

          {/* Back button for local mode */}
          {!isMultiplayer && (
            <div className="text-center mt-6">
              <button
                onClick={() => setLobbyView('menu')}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                Back to main menu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

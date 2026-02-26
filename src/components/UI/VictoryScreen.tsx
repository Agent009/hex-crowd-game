import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { returnToLobby } from '../../store/gameSlice';
import { Trophy, Crown, Users, RotateCcw, Home, Star, Shield } from 'lucide-react';

export const VictoryScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { victoryResult, activityEvents, teams, players } = useSelector((state: RootState) => state.game);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!victoryResult) return null;

  const teamColor = victoryResult.winnerTeamId
    ? teams.find(t => t.id === victoryResult.winnerTeamId)?.color
    : null;

  const eliminationEvents = activityEvents
    .filter(e => e.type === 'elimination' && e.playerId)
    .slice(0, 8);

  const handleReturnToLobby = () => {
    dispatch(returnToLobby());
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className={`relative w-full max-w-2xl mx-4 transition-all duration-700 ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'
        }`}
      >
        <div className="bg-slate-900 rounded-2xl border border-slate-600 shadow-2xl overflow-hidden">
          <div
            className="h-2 w-full"
            style={{ backgroundColor: teamColor || '#f59e0b' }}
          />

          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: `${teamColor || '#f59e0b'}22`, border: `2px solid ${teamColor || '#f59e0b'}` }}
              >
                <Trophy className="w-10 h-10" style={{ color: teamColor || '#f59e0b' }} />
              </div>
            </div>

            <div className="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-2">
              Game Over — Round {victoryResult.roundNumber}
            </div>

            <h1 className="text-4xl font-bold text-white mb-1">
              {victoryResult.isTeamVictory ? victoryResult.winnerTeamName : victoryResult.winnerName}
            </h1>

            <p className="text-slate-300 text-lg mb-6">
              {victoryResult.isTeamVictory ? 'wins the game!' : 'is the last survivor!'}
            </p>

            <div className="flex justify-center gap-2 mb-6">
              {victoryResult.isTeamVictory ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300 text-sm">Team Victory</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-600">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300 text-sm">Solo Victory</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-600">
                <Star className="w-4 h-4 text-blue-400" />
                <span className="text-slate-300 text-sm">Round {victoryResult.roundNumber}</span>
              </div>
            </div>

            {victoryResult.survivingPlayers.length > 0 && (
              <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-semibold uppercase tracking-wide">Survivors</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {victoryResult.survivingPlayers.map((name, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: `${teamColor || '#f59e0b'}33`, border: `1px solid ${teamColor || '#f59e0b'}66` }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {eliminationEvents.length > 0 && (
              <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700 text-left">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Elimination Log
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {eliminationEvents.map(event => (
                    <div key={event.id} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span>{event.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {teams.some(t => t.score > 0) && (
              <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Final Scores
                </div>
                <div className="space-y-1">
                  {[...teams]
                    .sort((a, b) => b.score - a.score)
                    .map(team => (
                      <div key={team.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-slate-300">{team.name}</span>
                        </div>
                        <span className="text-white font-semibold">{team.score} pts</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReturnToLobby}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors border border-slate-600"
              >
                <Home className="w-4 h-4" />
                Return to Lobby
              </button>
              <button
                onClick={handleReturnToLobby}
                className="flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold transition-colors shadow-lg"
                style={{ backgroundColor: teamColor || '#f59e0b' }}
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

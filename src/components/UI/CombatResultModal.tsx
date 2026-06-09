import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Shield, Swords, Trophy, X } from 'lucide-react';
import { RootState } from '../../store/store';
import { dismissCombatResult } from '../../store/gameSlice';
import { unitsData } from '../../data/unitsData';
import { CombatSideSummary } from '../../store/types';

export const CombatResultModal: React.FC = () => {
  const dispatch = useDispatch();
  const result = useSelector((state: RootState) => state.game.lastCombatResult);

  if (!result) return null;

  const winnerName =
    result.winnerId === result.attacker.playerId
      ? result.attacker.playerName
      : result.winnerId === result.defender.playerId
        ? result.defender.playerName
        : 'Stand-off';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-red-300" />
            <h2 className="text-lg font-bold text-white">Combat Report</h2>
          </div>
          <button
            onClick={() => dispatch(dismissCombatResult())}
            className="rounded-full bg-slate-700 p-1 text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 rounded-lg border border-amber-600/50 bg-amber-950/30 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-200">
              <Trophy className="h-5 w-5" />
              <span className="font-semibold">{winnerName}</span>
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Round {result.roundNumber} / {result.terrain} / ({result.location.q}, {result.location.r}, {result.location.s})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CombatSideCard title="Attacker" side={result.attacker} accent="red" />
            <CombatSideCard title="Defender" side={result.defender} accent="blue" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface CombatSideCardProps {
  title: string;
  side: CombatSideSummary;
  accent: 'red' | 'blue';
}

const CombatSideCard: React.FC<CombatSideCardProps> = ({ title, side, accent }) => {
  const accentClass = accent === 'red' ? 'border-red-700/60 bg-red-950/20' : 'border-blue-700/60 bg-blue-950/20';

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
          <div className="font-semibold text-white">Player {side.playerNumber} - {side.playerName}</div>
          <div className="text-xs text-slate-400">{side.heroName ?? 'No hero commander'}</div>
        </div>
        <Shield className="h-5 w-5 text-slate-300" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Power" value={side.power} />
        <Metric label="Roll" value={side.roll} />
        <Metric label="XP" value={side.xpGained} />
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {side.hpDamage > 0 && (
          <div className="text-red-200">Player damage: {side.hpDamage}</div>
        )}
        {side.heroLost && (
          <div className="text-red-200">Hero lost</div>
        )}
        {side.armyLosses.length > 0 && (
          <div className="text-slate-300">
            Losses: {side.armyLosses.map(loss => {
              const unit = unitsData[loss.unitId];
              return `${loss.count} ${unit?.name ?? loss.unitId}`;
            }).join(', ')}
          </div>
        )}
        {side.hpDamage === 0 && !side.heroLost && side.armyLosses.length === 0 && (
          <div className="text-slate-400">No losses</div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded bg-slate-950/70 px-2 py-2">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="font-bold text-white">{value}</div>
  </div>
);

import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { BarteringPanel } from './BarteringPanel';
import { ArrowLeftRight, X } from 'lucide-react';

interface TradeDockProps {
  onClose: () => void;
}

/**
 * Compact, board-anchored home for bartering. Reuses the full BarteringPanel
 * (propose / accept / reject / cancel) but in a small docked card instead of
 * the obstructive full-height side panel, so trading is a first-class, visible
 * action that doesn't cover the board.
 */
export const TradeDock: React.FC<TradeDockProps> = ({ onClose }) => {
  const { currentPhase } = useSelector((state: RootState) => state.game);

  return (
    <div className="fixed bottom-4 right-4 w-80 max-h-[70vh] z-[55] flex flex-col rounded-xl bg-slate-800/95 backdrop-blur border border-slate-600 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <ArrowLeftRight className="w-4 h-4 text-teal-400" />
          <span className="text-white text-sm font-semibold">Bartering</span>
          {currentPhase === 'bartering' && (
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-teal-600 text-white rounded-full px-2 py-0.5">Open</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <BarteringPanel />
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import {
  proposeTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  TradeProposal,
} from '../../store/gameSlice';
import { resourceDatabase } from '../../data/harvestData';
import {
  ArrowLeftRight,
  Plus,
  Minus,
  X,
  Check,
  Ban,
  ChevronDown,
  ChevronUp,
  Handshake,
} from 'lucide-react';

const RESOURCE_IDS = resourceDatabase.map(r => r.id);
const RESOURCE_NAME: Record<string, string> = Object.fromEntries(
  resourceDatabase.map(r => [r.id, r.name])
);

interface ResourceCounterProps {
  resourceId: string;
  value: number;
  max: number;
  onChange: (resourceId: string, delta: number) => void;
  disabled?: boolean;
}

const ResourceCounter: React.FC<ResourceCounterProps> = ({ resourceId, value, max, onChange, disabled }) => (
  <div className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
    <span className="text-slate-300 text-sm w-16">{RESOURCE_NAME[resourceId]}</span>
    <div className="flex items-center space-x-2">
      <button
        onClick={() => onChange(resourceId, -1)}
        disabled={disabled || value <= 0}
        className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <Minus className="w-3 h-3 text-white" />
      </button>
      <span className="text-white font-bold w-6 text-center">{value}</span>
      <button
        onClick={() => onChange(resourceId, 1)}
        disabled={disabled || value >= max}
        className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <Plus className="w-3 h-3 text-white" />
      </button>
      <span className="text-slate-500 text-xs w-10 text-right">/{max}</span>
    </div>
  </div>
);

interface ProposalCardProps {
  proposal: TradeProposal;
  currentPlayerId: string;
  players: { id: string; name: string; number: number }[];
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, currentPlayerId, players }) => {
  const dispatch = useDispatch();
  const fromPlayer = players.find(p => p.id === proposal.fromPlayerId);
  const toPlayer = players.find(p => p.id === proposal.toPlayerId);
  const isReceiver = proposal.toPlayerId === currentPlayerId;
  const isSender = proposal.fromPlayerId === currentPlayerId;

  const statusColors: Record<TradeProposal['status'], string> = {
    pending: 'border-amber-500 bg-amber-900/20',
    accepted: 'border-green-500 bg-green-900/20',
    rejected: 'border-red-500 bg-red-900/20',
    cancelled: 'border-slate-600 bg-slate-800/40',
  };

  const statusLabels: Record<TradeProposal['status'], string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  const offerEntries = Object.entries(proposal.offeredResources).filter(([, v]) => v > 0);
  const requestEntries = Object.entries(proposal.requestedResources).filter(([, v]) => v > 0);

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${statusColors[proposal.status]}`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-xs">
          {fromPlayer?.name} → {toPlayer?.name}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          proposal.status === 'pending' ? 'bg-amber-600 text-white' :
          proposal.status === 'accepted' ? 'bg-green-600 text-white' :
          proposal.status === 'rejected' ? 'bg-red-600 text-white' :
          'bg-slate-600 text-slate-300'
        }`}>
          {statusLabels[proposal.status]}
        </span>
      </div>

      <div className="flex items-center space-x-2 text-xs">
        <div className="flex-1 bg-slate-700 rounded p-2">
          <div className="text-green-400 font-semibold mb-1">Offering</div>
          {offerEntries.length > 0
            ? offerEntries.map(([rid, v]) => (
                <div key={rid} className="text-slate-200">{v}x {RESOURCE_NAME[rid]}</div>
              ))
            : <div className="text-slate-500 italic">Nothing</div>
          }
        </div>
        <ArrowLeftRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="flex-1 bg-slate-700 rounded p-2">
          <div className="text-amber-400 font-semibold mb-1">Requesting</div>
          {requestEntries.length > 0
            ? requestEntries.map(([rid, v]) => (
                <div key={rid} className="text-slate-200">{v}x {RESOURCE_NAME[rid]}</div>
              ))
            : <div className="text-slate-500 italic">Nothing</div>
          }
        </div>
      </div>

      {proposal.status === 'pending' && (
        <div className="flex space-x-2 pt-1">
          {isReceiver && (
            <>
              <button
                onClick={() => dispatch(acceptTrade({ tradeId: proposal.id, acceptingPlayerId: currentPlayerId }))}
                className="flex-1 flex items-center justify-center space-x-1 bg-green-600 hover:bg-green-500 text-white rounded px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                <Check className="w-3 h-3" />
                <span>Accept</span>
              </button>
              <button
                onClick={() => dispatch(rejectTrade({ tradeId: proposal.id, rejectingPlayerId: currentPlayerId }))}
                className="flex-1 flex items-center justify-center space-x-1 bg-red-700 hover:bg-red-600 text-white rounded px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                <Ban className="w-3 h-3" />
                <span>Reject</span>
              </button>
            </>
          )}
          {isSender && (
            <button
              onClick={() => dispatch(cancelTrade({ tradeId: proposal.id, cancellingPlayerId: currentPlayerId }))}
              className="flex-1 flex items-center justify-center space-x-1 bg-slate-600 hover:bg-slate-500 text-white rounded px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const BarteringPanel: React.FC = () => {
  const dispatch = useDispatch();
  const { players, currentPlayer, playerStats, tradeProposals, currentPhase } = useSelector(
    (state: RootState) => state.game
  );

  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [offeredResources, setOfferedResources] = useState<Record<string, number>>({});
  const [requestedResources, setRequestedResources] = useState<Record<string, number>>({});
  const [showProposals, setShowProposals] = useState(true);
  const [showNewTrade, setShowNewTrade] = useState(false);

  const currentStats = currentPlayer ? playerStats[currentPlayer.id] : null;
  const otherPlayers = players.filter(p => p.id !== currentPlayer?.id);

  const relevantProposals = tradeProposals.filter(
    t =>
      (t.fromPlayerId === currentPlayer?.id || t.toPlayerId === currentPlayer?.id) &&
      t.status !== 'cancelled'
  );

  const pendingInbound = relevantProposals.filter(
    t => t.toPlayerId === currentPlayer?.id && t.status === 'pending'
  );

  const isBarteringPhase = currentPhase === 'bartering';

  const handleResourceChange = (
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    resourceId: string,
    delta: number
  ) => {
    setter(prev => ({
      ...prev,
      [resourceId]: Math.max(0, (prev[resourceId] || 0) + delta),
    }));
  };

  const handlePropose = () => {
    if (!currentPlayer || !targetPlayerId) return;
    const hasOffer = Object.values(offeredResources).some(v => v > 0);
    const hasRequest = Object.values(requestedResources).some(v => v > 0);
    if (!hasOffer && !hasRequest) return;

    dispatch(proposeTrade({
      fromPlayerId: currentPlayer.id,
      toPlayerId: targetPlayerId,
      offeredResources,
      requestedResources,
    }));
    setOfferedResources({});
    setRequestedResources({});
    setTargetPlayerId('');
    setShowNewTrade(false);
  };

  const isValidProposal = () => {
    if (!targetPlayerId || !currentStats) return false;
    const hasOffer = Object.values(offeredResources).some(v => v > 0);
    const hasRequest = Object.values(requestedResources).some(v => v > 0);
    return hasOffer || hasRequest;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!isBarteringPhase && (
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-3 mb-3 text-center">
          <span className="text-amber-300 text-sm">Trading is only available during the Bartering Phase</span>
        </div>
      )}

      {/* Incoming Proposals Alert */}
      {pendingInbound.length > 0 && (
        <div className="bg-amber-800/50 border border-amber-500 rounded-lg p-2 mb-3 flex items-center space-x-2">
          <Handshake className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-200 text-sm font-semibold">
            {pendingInbound.length} incoming trade proposal{pendingInbound.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Proposals List */}
      <div className="mb-3">
        <button
          onClick={() => setShowProposals(!showProposals)}
          className="w-full flex items-center justify-between bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 transition-colors"
        >
          <span className="text-white text-sm font-semibold">
            Trade History {relevantProposals.length > 0 && `(${relevantProposals.length})`}
          </span>
          {showProposals ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showProposals && (
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {relevantProposals.length > 0 ? (
              relevantProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  currentPlayerId={currentPlayer?.id ?? ''}
                  players={players}
                />
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-3 bg-slate-800 rounded-lg">
                No trade history yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Trade Form */}
      <div>
        <button
          onClick={() => setShowNewTrade(!showNewTrade)}
          disabled={!isBarteringPhase}
          className="w-full flex items-center justify-between bg-green-800 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg px-3 py-2 transition-colors"
        >
          <span className="text-white text-sm font-semibold">Propose New Trade</span>
          {showNewTrade ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
        </button>

        {showNewTrade && isBarteringPhase && (
          <div className="mt-2 space-y-3 bg-slate-800 rounded-lg p-3">
            {/* Target Player Select */}
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Trade with</label>
              <select
                value={targetPlayerId}
                onChange={e => setTargetPlayerId(e.target.value)}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-slate-600 focus:border-green-500 focus:outline-none"
              >
                <option value="">Select a player...</option>
                {otherPlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    Player {p.number} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Offer section */}
            <div>
              <div className="text-green-400 text-xs font-semibold mb-2 uppercase tracking-wide">You offer</div>
              <div className="space-y-1">
                {RESOURCE_IDS.map(rid => (
                  <ResourceCounter
                    key={rid}
                    resourceId={rid}
                    value={offeredResources[rid] || 0}
                    max={currentStats?.resources[rid] || 0}
                    onChange={(resourceId, delta) =>
                      handleResourceChange(setOfferedResources, resourceId, delta)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Request section */}
            <div>
              <div className="text-amber-400 text-xs font-semibold mb-2 uppercase tracking-wide">You request</div>
              <div className="space-y-1">
                {RESOURCE_IDS.map(rid => (
                  <ResourceCounter
                    key={rid}
                    resourceId={rid}
                    value={requestedResources[rid] || 0}
                    max={99}
                    onChange={(resourceId, delta) =>
                      handleResourceChange(setRequestedResources, resourceId, delta)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handlePropose}
              disabled={!isValidProposal()}
              className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg py-2 font-semibold transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Send Proposal</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

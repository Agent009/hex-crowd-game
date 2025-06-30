import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { dismissPhaseOverlay, GamePhase, phaseOrder, phaseDurations, phaseOverlayDurations, dismissiblePhases, ActivityEvent } from '../../store/gameSlice';
import {
  Clock,
  Zap,
  Users,
  AlertTriangle,
  TrendingUp,
  Skull,
  Play,
  Pause,
  X,
  CheckCircle,
  Timer,
  Coins,
  MapPin,
  Package,
  Hammer,
  Heart
} from 'lucide-react';

interface PhaseData {
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}

const phaseDefinitions: Record<GamePhase, PhaseData> = {
  round_start: {
    name: 'Round Start',
    description: 'A new round begins. Prepare for action!',
    icon: Play,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-900'
  },
  ap_renewal: {
    name: 'AP Renewal Phase',
    description: 'All players receive +2 Action Points',
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900'
  },
  interaction: {
    name: 'Interaction Phase',
    description: 'Players can move, harvest, craft, and use items',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900'
  },
  bartering: {
    name: 'Bartering Phase',
    description: 'Trade negotiations and resource exchanges',
    icon: Coins,
    color: 'text-green-400',
    bgColor: 'bg-green-900'
  },
  terrain_effects: {
    name: 'Terrain Effects Phase',
    description: 'Environmental effects applied to all players',
    icon: TrendingUp,
    color: 'text-purple-400',
    bgColor: 'bg-purple-900'
  },
  disaster_check: {
    name: 'Disaster Check Phase',
    description: 'Rolling for natural disasters and catastrophes',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-900'
  },
  elimination: {
    name: 'Elimination Phase',
    description: 'Removing players with 0 HP from the game',
    icon: Skull,
    color: 'text-red-400',
    bgColor: 'bg-red-900'
  }
};

export const RoundPhaseOverlay: React.FC = () => {
  const dispatch = useDispatch();
  const {
    roundNumber,
    players,
    playerStats,
    currentPhase,
    phaseStartTime,
    phaseTimer,
    showPhaseOverlay,
    activityEvents
  } = useSelector((state: RootState) => state.game);

  const [isVisible, setIsVisible] = useState(true);
  const [overlayTimer, setOverlayTimer] = useState(0);

  const phaseData = phaseDefinitions[currentPhase];
  const canDismiss = dismissiblePhases.includes(currentPhase);
  const overlayDuration = phaseOverlayDurations[currentPhase];
  const phaseDuration = phaseDurations[currentPhase];

  // Filter events related to the current phase
  const getPhaseRelatedEvents = (): ActivityEvent[] => {
    const phaseStartTimestamp = phaseStartTime;
    const currentTime = Date.now();

    // Get events that occurred after the phase started
    const recentEvents = activityEvents.filter(event =>
      event.timestamp >= phaseStartTimestamp && event.timestamp <= currentTime
    );

    // Filter events based on phase type
    switch (currentPhase) {
      case 'ap_renewal':
        return recentEvents.filter(event =>
          event.type === 'phase_effect' && event.subtype === 'ap_renewal'
        );
      case 'terrain_effects':
        return recentEvents.filter(event =>
          event.type === 'terrain_effect' || event.subtype === 'terrain_effect'
        );
      case 'disaster_check':
        return recentEvents.filter(event => event.type === 'disaster');
      case 'elimination':
        return recentEvents.filter(event => event.type === 'elimination');
      default:
        return recentEvents.slice(0, 5); // Show recent events for other phases
    }
  };

  useEffect(() => {
    if (showPhaseOverlay) {
      setIsVisible(true);
      setOverlayTimer(overlayDuration);
    }
  }, [showPhaseOverlay, overlayDuration]);

  useEffect(() => {
    if (!showPhaseOverlay || !isVisible) return;

    const interval = setInterval(() => {
      setOverlayTimer(prev => {
        if (prev <= 1) {
          // Auto-dismiss overlay when timer reaches 0
          setIsVisible(false);
          setTimeout(() => dispatch(dismissPhaseOverlay()), 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showPhaseOverlay, isVisible, dispatch]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDismiss = () => {
    if (canDismiss) {
      setIsVisible(false);
      setTimeout(() => dispatch(dismissPhaseOverlay()), 300);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canDismiss) {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canDismiss]);

  if (!showPhaseOverlay || !isVisible) return null;

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'phase_effect': return Zap;
      case 'terrain_effect': return AlertTriangle;
      case 'disaster': return AlertTriangle;
      case 'elimination': return Skull;
      case 'movement': return MapPin;
      case 'harvesting': return Package;
      case 'crafting': return Hammer;
      case 'damage': return Heart;
      default: return Clock;
    }
  };

  const phaseProgress = Math.max(0, ((phaseDuration - phaseTimer) / phaseDuration) * 100);

  const getPhaseSpecificInfo = () => {
    switch (currentPhase) {
      case 'ap_renewal':
        return (
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-300 mb-2">+2 AP</div>
            <div className="text-yellow-100">All players gain Action Points</div>
          </div>
        );

      case 'interaction':
        const activePlayers = players.filter(p => {
          const stats = playerStats[p.id];
          return stats && stats.hp > 0;
        });
        return (
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-300 mb-2">{activePlayers.length}</div>
            <div className="text-blue-100">Active players can take actions</div>
          </div>
        );

      case 'bartering':
        return (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-300 mb-2">Trade Time</div>
            <div className="text-green-100">Negotiate resource exchanges</div>
          </div>
        );

      case 'terrain_effects':
        const playersOnDangerousTerrain = players.filter(p => {
          const stats = playerStats[p.id];
          return stats && stats.hp > 0; // Simplified check
        });
        return (
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-300 mb-2">{playersOnDangerousTerrain.length}</div>
            <div className="text-purple-100">Players affected by terrain</div>
          </div>
        );

      case 'disaster_check':
        return (
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-300 mb-2">Rolling...</div>
            <div className="text-orange-100">Checking for natural disasters</div>
          </div>
        );

      case 'elimination':
        const eliminatedPlayers = players.filter(p => {
          const stats = playerStats[p.id];
          return stats && stats.hp <= 0;
        });
        return (
          <div className="text-center">
            {eliminatedPlayers.length > 0 ? (
              <>
                <div className="text-2xl font-bold text-red-300 mb-2">{eliminatedPlayers.length}</div>
                <div className="text-red-100">Players eliminated</div>
                <div className="mt-2 text-sm text-red-200">
                  {eliminatedPlayers.map(p => p.name).join(', ')}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-300 mb-2">0</div>
                <div className="text-green-100">No eliminations this round</div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const phaseEvents = getPhaseRelatedEvents();

  const Icon = phaseData.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
      <div className={`${phaseData.bgColor} bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full mx-4 border border-opacity-30 border-white shadow-2xl animate-slide-in-from-right`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className={`${phaseData.bgColor} bg-opacity-50 rounded-full p-4`}>
              <Icon className={`w-12 h-12 ${phaseData.color}`} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{phaseData.name}</h2>
          <p className="text-gray-200 text-sm">{phaseData.description}</p>
        </div>

        {/* Round Info */}
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-white mb-1">Round {roundNumber}</div>
          <div className="text-lg text-gray-200">
            Phase: {formatTime(phaseTimer)} remaining
          </div>
          <div className="text-sm text-gray-300">
            Overlay: {formatTime(overlayTimer)} until auto-dismiss
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-700 bg-opacity-50 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${phaseData.color.replace('text-', 'bg-')}`}
              style={{ width: `${phaseProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-300 mt-1">
            <span>0:00</span>
            <span>{formatTime(phaseDuration)}</span>
          </div>
        </div>

        {/* Phase-specific Information */}
        <div className="mb-4">
          {getPhaseSpecificInfo()}
        </div>

        {/* Phase Events */}
        {phaseEvents.length > 0 && (
          <div className="mb-6">
            <div className="text-center text-sm text-gray-300 mb-3">Phase Events</div>
            <div className="bg-black bg-opacity-30 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="space-y-2">
                {phaseEvents.slice(0, 8).map(event => {
                  const EventIcon = getEventIcon(event.type);
                  return (
                    <div key={event.id} className="flex items-start space-x-2 text-xs">
                      <EventIcon className="w-3 h-3 mt-0.5 text-gray-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white">{event.message}</div>
                        {event.playerName && (
                          <div className="text-gray-400">Player: {event.playerName}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {phaseEvents.length === 0 && (
                <div className="text-center text-gray-400 text-xs py-2">
                  No events yet this phase
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase Progress Indicator */}
        <div className="mb-6">
          <div className="text-center text-sm text-gray-300 mb-2">Phase Progress</div>
          <div className="flex justify-center space-x-2">
            {phaseOrder.map((phase, index) => {
              const phaseIndex = phaseOrder.indexOf(currentPhase);
              const isCurrentPhase = index === phaseIndex;
              const isPastPhase = index < phaseIndex;

              return (
                <div
                  key={phase}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isCurrentPhase 
                      ? `${phaseData.color.replace('text-', 'bg-')} ring-2 ring-white ring-opacity-50` 
                      : isPastPhase 
                        ? 'bg-green-500' 
                        : 'bg-gray-600'
                  }`}
                  title={phaseDefinitions[phase].name}
                />
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-3">
          {canDismiss && (
            <button
              onClick={handleDismiss}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Dismiss</span>
            </button>
          )}

          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            disabled
          >
            <Timer className="w-4 h-4" />
            <span>Phase Active</span>
          </button>
        </div>

        {/* Accessibility Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Press ESC to dismiss • Screen reader compatible
          </p>
        </div>
      </div>
    </div>
  );
};

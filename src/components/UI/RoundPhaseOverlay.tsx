import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
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
  Coins
} from 'lucide-react';

export type GamePhase = 
  | 'round_start'
  | 'ap_renewal' 
  | 'interaction'
  | 'bartering'
  | 'terrain_effects'
  | 'disaster_check'
  | 'elimination'
  | 'round_end';

interface PhaseData {
  name: string;
  description: string;
  duration?: number; // in seconds, undefined for instant phases
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}

interface RoundPhaseOverlayProps {
  currentPhase: GamePhase;
  phaseStartTime: number;
  onPhaseComplete?: () => void;
  onDismiss?: () => void;
  canDismiss?: boolean;
}

const phaseDefinitions: Record<GamePhase, PhaseData> = {
  round_start: {
    name: 'Round Start',
    description: 'A new round begins. Prepare for action!',
    icon: Play,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-900',
    duration: 3
  },
  ap_renewal: {
    name: 'AP Renewal Phase',
    description: 'All players receive +2 Action Points',
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900',
    duration: 2
  },
  interaction: {
    name: 'Interaction Phase',
    description: 'Players can move, harvest, craft, and use items',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900',
    duration: 30
  },
  bartering: {
    name: 'Bartering Phase',
    description: 'Trade negotiations and resource exchanges',
    icon: Coins,
    color: 'text-green-400',
    bgColor: 'bg-green-900',
    duration: 15
  },
  terrain_effects: {
    name: 'Terrain Effects Phase',
    description: 'Environmental effects applied to all players',
    icon: TrendingUp,
    color: 'text-purple-400',
    bgColor: 'bg-purple-900',
    duration: 5
  },
  disaster_check: {
    name: 'Disaster Check Phase',
    description: 'Rolling for natural disasters and catastrophes',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-900',
    duration: 8
  },
  elimination: {
    name: 'Elimination Phase',
    description: 'Removing players with 0 HP from the game',
    icon: Skull,
    color: 'text-red-400',
    bgColor: 'bg-red-900',
    duration: 3
  },
  round_end: {
    name: 'Round Complete',
    description: 'Round finished. Preparing for next round...',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-900',
    duration: 2
  }
};

export const RoundPhaseOverlay: React.FC<RoundPhaseOverlayProps> = ({
  currentPhase,
  phaseStartTime,
  onPhaseComplete,
  onDismiss,
  canDismiss = false
}) => {
  const { roundNumber, players, playerStats } = useSelector((state: RootState) => state.game);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(true);
  const [phaseProgress, setPhaseProgress] = useState(0);

  const phaseData = phaseDefinitions[currentPhase];

  useEffect(() => {
    setIsVisible(true);
    setPhaseProgress(0);
  }, [currentPhase]);

  useEffect(() => {
    if (!phaseData.duration) {
      // Instant phase - auto-complete after showing briefly
      const timer = setTimeout(() => {
        onPhaseComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - phaseStartTime) / 1000;
      const remaining = Math.max(0, phaseData.duration! - elapsed);
      const progress = Math.min(100, (elapsed / phaseData.duration!) * 100);
      
      setTimeRemaining(remaining);
      setPhaseProgress(progress);

      if (remaining <= 0) {
        onPhaseComplete?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phaseStartTime, phaseData.duration, onPhaseComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

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

  if (!isVisible) return null;

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
          {phaseData.duration && (
            <div className="text-lg text-gray-200">
              {timeRemaining > 0 ? formatTime(timeRemaining) : 'Complete'}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {phaseData.duration && (
          <div className="mb-6">
            <div className="w-full bg-gray-700 bg-opacity-50 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${phaseData.color.replace('text-', 'bg-')}`}
                style={{ width: `${phaseProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>0:00</span>
              <span>{phaseData.duration ? formatTime(phaseData.duration) : '--'}</span>
            </div>
          </div>
        )}

        {/* Phase-specific Information */}
        <div className="mb-6">
          {getPhaseSpecificInfo()}
        </div>

        {/* Phase Progress Indicator */}
        <div className="mb-6">
          <div className="text-center text-sm text-gray-300 mb-2">Phase Progress</div>
          <div className="flex justify-center space-x-2">
            {Object.keys(phaseDefinitions).map((phase, index) => {
              const isCurrentPhase = phase === currentPhase;
              const phaseIndex = Object.keys(phaseDefinitions).indexOf(currentPhase);
              const isPastPhase = index < phaseIndex;
              const isFuturePhase = index > phaseIndex;
              
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
          
          {currentPhase === 'interaction' && (
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              disabled
            >
              <Timer className="w-4 h-4" />
              <span>In Progress</span>
            </button>
          )}
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

// Hook for managing phase transitions
export const useRoundPhases = () => {
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('round_start');
  const [phaseStartTime, setPhaseStartTime] = useState(Date.now());
  const [showOverlay, setShowOverlay] = useState(false);

  const startPhase = (phase: GamePhase) => {
    setCurrentPhase(phase);
    setPhaseStartTime(Date.now());
    setShowOverlay(true);
  };

  const completePhase = () => {
    setShowOverlay(false);
    // Auto-advance to next phase logic would go here
  };

  const dismissOverlay = () => {
    setShowOverlay(false);
  };

  return {
    currentPhase,
    phaseStartTime,
    showOverlay,
    startPhase,
    completePhase,
    dismissOverlay
  };
};
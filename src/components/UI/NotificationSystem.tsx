import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ActivityLog } from './ActivityLog';
import { RoundPhaseOverlay, useRoundPhases, GamePhase } from './RoundPhaseOverlay';
import { 
  Volume2, 
  VolumeX, 
  Settings, 
  Eye, 
  EyeOff,
  Bell,
  BellOff
} from 'lucide-react';

interface NotificationSettings {
  soundEnabled: boolean;
  phaseOverlaysEnabled: boolean;
  activityLogVisible: boolean;
  autoScrollEnabled: boolean;
  filterPresets: string[];
}

export const NotificationSystem: React.FC = () => {
  const { roundNumber, gameMode } = useSelector((state: RootState) => state.game);
  const [settings, setSettings] = useState<NotificationSettings>({
    soundEnabled: true,
    phaseOverlaysEnabled: true,
    activityLogVisible: true,
    autoScrollEnabled: true,
    filterPresets: []
  });
  const [showSettings, setShowSettings] = useState(false);
  const [activityLogMinimized, setActivityLogMinimized] = useState(false);
  
  const {
    currentPhase,
    phaseStartTime,
    showOverlay,
    startPhase,
    completePhase,
    dismissOverlay
  } = useRoundPhases();

  // Demo phase progression for testing
  useEffect(() => {
    if (gameMode === 'playing' && settings.phaseOverlaysEnabled) {
      // Start with round start phase
      startPhase('round_start');
    }
  }, [roundNumber, gameMode, settings.phaseOverlaysEnabled]);

  // Sound effects for phase changes
  useEffect(() => {
    if (settings.soundEnabled && showOverlay) {
      playPhaseSound(currentPhase);
    }
  }, [currentPhase, showOverlay, settings.soundEnabled]);

  const playPhaseSound = (phase: GamePhase) => {
    if (!settings.soundEnabled) return;
    
    // Create audio context for sound effects
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    };

    // Different sounds for different phases
    switch (phase) {
      case 'round_start':
        playTone(523, 0.3); // C note
        setTimeout(() => playTone(659, 0.3), 150); // E note
        setTimeout(() => playTone(784, 0.5), 300); // G note
        break;
      case 'disaster_check':
        playTone(220, 0.2, 'sawtooth'); // Warning sound
        setTimeout(() => playTone(196, 0.2, 'sawtooth'), 100);
        setTimeout(() => playTone(174, 0.3, 'sawtooth'), 200);
        break;
      case 'elimination':
        playTone(147, 0.8, 'triangle'); // Low, somber tone
        break;
      case 'interaction':
        playTone(440, 0.2); // A note - action time
        break;
      default:
        playTone(330, 0.2); // Default notification sound
    }
  };

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K, 
    value: NotificationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handlePhaseComplete = () => {
    completePhase();
    
    // Demo: Auto-advance to next phase for testing
    setTimeout(() => {
      const phases: GamePhase[] = [
        'round_start', 'ap_renewal', 'interaction', 'bartering', 
        'terrain_effects', 'disaster_check', 'elimination', 'round_end'
      ];
      const currentIndex = phases.indexOf(currentPhase);
      const nextPhase = phases[(currentIndex + 1) % phases.length];
      
      if (settings.phaseOverlaysEnabled) {
        startPhase(nextPhase);
      }
    }, 1000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showOverlay) {
        dismissOverlay();
      }
      if (event.key === 'l' && event.ctrlKey) {
        event.preventDefault();
        setActivityLogMinimized(!activityLogMinimized);
      }
      if (event.key === 'm' && event.ctrlKey) {
        event.preventDefault();
        updateSetting('soundEnabled', !settings.soundEnabled);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOverlay, activityLogMinimized, settings.soundEnabled]);

  if (gameMode !== 'playing') return null;

  return (
    <>
      {/* Settings Panel */}
      <div className="fixed top-4 right-4 z-60">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg shadow-lg border border-slate-600 transition-colors"
          title="Notification Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {showSettings && (
          <div className="absolute top-12 right-0 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-600 p-4 animate-slide-in-from-right">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <Bell className="w-4 h-4 mr-2" />
              Notification Settings
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Sound Effects</span>
                <button
                  onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                  className={`p-1 rounded transition-colors ${
                    settings.soundEnabled ? 'text-green-400' : 'text-slate-500'
                  }`}
                >
                  {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Phase Overlays</span>
                <button
                  onClick={() => updateSetting('phaseOverlaysEnabled', !settings.phaseOverlaysEnabled)}
                  className={`p-1 rounded transition-colors ${
                    settings.phaseOverlaysEnabled ? 'text-green-400' : 'text-slate-500'
                  }`}
                >
                  {settings.phaseOverlaysEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Activity Log</span>
                <button
                  onClick={() => updateSetting('activityLogVisible', !settings.activityLogVisible)}
                  className={`p-1 rounded transition-colors ${
                    settings.activityLogVisible ? 'text-green-400' : 'text-slate-500'
                  }`}
                >
                  {settings.activityLogVisible ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-600">
              <div className="text-slate-400 text-xs">
                <div>Ctrl+L: Toggle Activity Log</div>
                <div>Ctrl+M: Toggle Sound</div>
                <div>ESC: Dismiss Overlay</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity Log */}
      {settings.activityLogVisible && (
        <ActivityLog
          isMinimized={activityLogMinimized}
          onToggleMinimize={() => setActivityLogMinimized(!activityLogMinimized)}
        />
      )}

      {/* Round Phase Overlay */}
      {showOverlay && settings.phaseOverlaysEnabled && (
        <RoundPhaseOverlay
          currentPhase={currentPhase}
          phaseStartTime={phaseStartTime}
          onPhaseComplete={handlePhaseComplete}
          onDismiss={dismissOverlay}
          canDismiss={currentPhase === 'interaction'}
        />
      )}

      {/* Accessibility Announcements */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {showOverlay && `${currentPhase.replace('_', ' ')} phase started`}
      </div>
    </>
  );
};
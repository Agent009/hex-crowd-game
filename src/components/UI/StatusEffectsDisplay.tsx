import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import {
  Heart,
  Zap,
  Package,
  Droplets,
  AlertTriangle,
  X,
  Skull
} from 'lucide-react';

interface StatusEffect {
  id: string;
  message: string;
  type: 'item_used' | 'resource_consumed' | 'damage' | 'disaster';
  timestamp: number;
}

export const StatusEffectsDisplay: React.FC = () => {
  const { currentPlayer, playerStats } = useSelector((state: RootState) => state.game);
  const [displayedEffects, setDisplayedEffects] = useState<StatusEffect[]>([]);
  const [lastEffectsCheck, setLastEffectsCheck] = useState<string[]>([]);

  const currentPlayerStats = currentPlayer ? playerStats[currentPlayer.id] : null;

  useEffect(() => {
    if (!currentPlayerStats) return;

    const currentEffects = currentPlayerStats.statusEffects || [];

    // Check for new effects
    const newEffects = currentEffects.filter(effect => !lastEffectsCheck.includes(effect));

    if (newEffects.length > 0) {
      const newStatusEffects: StatusEffect[] = newEffects.map((effect, index) => ({
        id: `${Date.now()}_${index}`,
        message: effect,
        type: getEffectType(effect),
        timestamp: Date.now()
      }));

      setDisplayedEffects(prev => [...prev, ...newStatusEffects]);

      // Auto-remove effects after 5 seconds
      newStatusEffects.forEach(effect => {
        setTimeout(() => {
          setDisplayedEffects(prev => prev.filter(e => e.id !== effect.id));
        }, 5000);
      });
    }

    setLastEffectsCheck(currentEffects);
  }, [currentPlayerStats?.statusEffects, lastEffectsCheck]);

  const getEffectType = (effect: string): StatusEffect['type'] => {
    if (effect.includes('Used')) return 'item_used';
    if (effect.includes('Consumed')) return 'resource_consumed';
    if (effect.includes('damage') || effect.includes('Lost') || effect.includes('HP')) return 'damage';
    if (effect.includes('Earthquake') || effect.includes('Sandstorm') || effect.includes('Wildfire') || effect.includes('Tsunami') || effect.includes('Storm')) return 'disaster';
    return 'damage';
  };

  const getEffectIcon = (type: StatusEffect['type']) => {
    switch (type) {
      case 'item_used': return Package;
      case 'resource_consumed': return Droplets;
      case 'damage': return Heart;
      case 'disaster': return AlertTriangle;
      default: return Zap;
    }
  };

  const getEffectColor = (type: StatusEffect['type']) => {
    switch (type) {
      case 'item_used': return 'bg-purple-600 border-purple-500 text-purple-100';
      case 'resource_consumed': return 'bg-blue-600 border-blue-500 text-blue-100';
      case 'damage': return 'bg-red-600 border-red-500 text-red-100';
      case 'disaster': return 'bg-orange-600 border-orange-500 text-orange-100';
      default: return 'bg-gray-600 border-gray-500 text-gray-100';
    }
  };

  const removeEffect = (effectId: string) => {
    setDisplayedEffects(prev => prev.filter(e => e.id !== effectId));
  };

  if (displayedEffects.length === 0) return null;

  return (
    <div className="fixed top-32 left-4 z-50 space-y-2 max-w-sm">
      {displayedEffects.map(effect => {
        const Icon = getEffectIcon(effect.type);
        const colorClass = getEffectColor(effect.type);

        return (
          <div
            key={effect.id}
            className={`${colorClass} border rounded-lg p-3 shadow-lg animate-slide-in-left`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{effect.message}</span>
              </div>
              <button
                onClick={() => removeEffect(effect.id)}
                className="text-current opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Player HP and Status Bar Component
export const PlayerStatusBar: React.FC = () => {
  const { currentPlayer, playerStats } = useSelector((state: RootState) => state.game);

  const currentPlayerStats = currentPlayer ? playerStats[currentPlayer.id] : null;

  if (!currentPlayer || !currentPlayerStats) return null;

  const hpPercentage = (currentPlayerStats.hp / 10) * 100; // Assuming max HP is 10
  const isLowHP = currentPlayerStats.hp <= 3;
  const isDead = currentPlayerStats.hp <= 0;

  return (
    <div className="fixed top-20 left-4 z-40 bg-slate-800 rounded-lg p-3 shadow-lg border border-slate-600">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
            isDead ? 'bg-red-800' : 'bg-red-600'
          }`}>
            {currentPlayer.number}
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{currentPlayer.name}</div>
            <div className="text-slate-400 text-xs">Player #{currentPlayer.number}</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isDead ? (
            <div className="flex items-center space-x-1 text-red-400">
              <Skull className="w-4 h-4" />
              <span className="text-sm font-bold">ELIMINATED</span>
            </div>
          ) : (
            <>
              <Heart className={`w-4 h-4 ${isLowHP ? 'text-red-400' : 'text-red-500'}`} />
              <div className="flex flex-col">
                <span className={`text-sm font-bold ${isLowHP ? 'text-red-400' : 'text-white'}`}>
                  {currentPlayerStats.hp}/10 HP
                </span>
                <div className="w-16 bg-slate-700 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      isLowHP ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${hpPercentage}%` }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center space-x-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm font-bold">
              {currentPlayerStats.actionPoints} AP
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
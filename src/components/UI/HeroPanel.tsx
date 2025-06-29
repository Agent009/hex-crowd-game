import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { selectHero } from '../../store/gameSlice';
import { Sword, Shield, Zap, Brain, Footprints, Star, ChevronDown, ChevronUp } from 'lucide-react';

export const HeroPanel: React.FC = () => {
  const dispatch = useDispatch();
  const { heroes, selectedHero } = useSelector((state: RootState) => state.game);
  const [expandedHero, setExpandedHero] = React.useState<string | null>(selectedHero);

  const selectedHeroData = heroes.find(h => h.id === selectedHero);

  React.useEffect(() => {
    if (selectedHero) {
      setExpandedHero(selectedHero);
    }
  }, [selectedHero]);

  return (
    <div className="w-full">
      <div className="max-h-80 overflow-y-auto">
        {heroes.map(hero => (
          <div
            key={hero.id}
            className={`p-3 border-b border-slate-700 cursor-pointer transition-colors ${
              selectedHero === hero.id 
                ? 'bg-blue-900 border-blue-600' 
                : 'hover:bg-slate-700'
            }`}
            onClick={() => {
              dispatch(selectHero(hero.id));
              setExpandedHero(expandedHero === hero.id ? null : hero.id);
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg">
                  🧙
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">{hero.name}</h3>
                  <p className="text-slate-300 text-xs capitalize">
                    {hero.faction} • Level {hero.level}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedHero === hero.id && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                )}
                {expandedHero === hero.id ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Compact stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <Footprints className="w-3 h-3 text-green-400" />
                <span className="text-slate-300">
                  {hero.movement}/{hero.maxMovement}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-slate-300">{hero.experience} XP</span>
              </div>
            </div>

            {/* Expanded details */}
            {expandedHero === hero.id && (
              <div className="mt-3 pt-3 border-t border-slate-600">
                {/* Hero Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center">
                    <Sword className="w-4 h-4 text-red-400 mx-auto mb-1" />
                    <div className="text-xs text-slate-400">Attack</div>
                    <div className="text-white font-semibold text-sm">8</div>
                  </div>
                  <div className="text-center">
                    <Shield className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                    <div className="text-xs text-slate-400">Defense</div>
                    <div className="text-white font-semibold text-sm">6</div>
                  </div>
                  <div className="text-center">
                    <Zap className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                    <div className="text-xs text-slate-400">Spell Power</div>
                    <div className="text-white font-semibold text-sm">4</div>
                  </div>
                  <div className="text-center">
                    <Brain className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-xs text-slate-400">Knowledge</div>
                    <div className="text-white font-semibold text-sm">3</div>
                  </div>
                </div>

                {/* Army Overview */}
                <div className="space-y-1">
                  <div className="text-slate-400 text-xs font-semibold">Army:</div>
                  {hero.army.slice(0, 3).map(unit => (
                    <div key={unit.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 capitalize">
                        {unit.type.replace('_', ' ')}
                      </span>
                      <span className="text-white font-semibold">{unit.count}</span>
                    </div>
                  ))}
                  {hero.army.length > 3 && (
                    <div className="text-slate-400 text-xs">
                      +{hero.army.length - 3} more units
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition-colors">
                    View Army
                  </button>
                  <button className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded transition-colors">
                    Skills
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      {selectedHeroData && (
        <div className="p-3 bg-slate-900 border-t border-slate-600">
          <div className="text-xs text-slate-400 mb-2">Quick Actions:</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 rounded transition-colors">
              Cast Spell
            </button>
            <button className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 rounded transition-colors">
              Rest
            </button>
          </div>
        </div>
      )}

      {heroes.length === 0 && (
        <div className="p-4 text-center text-slate-400">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2">
            🧙
          </div>
          <p className="text-sm">No heroes recruited</p>
          <p className="text-xs mt-1">Visit a tavern to hire heroes</p>
        </div>
      )}
    </div>
  );
};

// Separate component for minimized hero panel
export const MinimizedHeroPanel: React.FC = () => {
  const { heroes, selectedHero } = useSelector((state: RootState) => state.game);
  const selectedHeroData = heroes.find(h => h.id === selectedHero);

  if (!selectedHeroData) return null;

  return (
    <div className="w-full p-2">
      <div className="flex flex-col items-center space-y-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">
          🧙
        </div>
        <div className="text-center">
          <div className="text-white text-xs font-semibold">{selectedHeroData.name}</div>
          <div className="text-slate-400 text-xs">L{selectedHeroData.level}</div>
        </div>
        <div className="flex flex-col items-center space-y-1 text-xs">
          <div className="flex items-center space-x-1">
            <Footprints className="w-3 h-3 text-green-400" />
            <span className="text-slate-300">{selectedHeroData.movement}</span>
          </div>
          <div className="text-slate-400">
            {selectedHeroData.army.reduce((sum, unit) => sum + unit.count, 0)} units
          </div>
        </div>
      </div>
    </div>
  );
};

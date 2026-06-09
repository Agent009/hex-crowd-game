import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BookOpen,
  Crown,
  Heart,
  Shield,
  Sparkles,
  Swords,
  Target,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react';
import { RootState } from '../../store/store';
import {
  castSpell,
  initiateCombat,
  learnSkill,
  recruitHero,
  recruitUnit,
  restHero,
} from '../../store/gameSlice';
import {
  HERO_RECRUIT_AP_COST,
  HERO_RECRUIT_RESOURCE_COST,
  heroClassList,
  heroClasses,
} from '../../data/heroesData';
import { skillList, skillEffectAtRank } from '../../data/skillsData';
import { spellList, spellEffectValue } from '../../data/spellsData';
import { MAX_ARMY_SIZE, armyUnitCount, unitList, unitsData } from '../../data/unitsData';
import { cubeDistance } from '../../utils/hexGrid';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { resourceDatabase } from '../../data/harvestData';
import { COMBAT_AP_COST } from '../../game/combat';

interface HeroCommandPanelProps {
  onClose: () => void;
}

type HeroTab = 'hero' | 'army' | 'skills' | 'spells' | 'combat';

const RESOURCE_NAME: Record<string, string> = Object.fromEntries(
  resourceDatabase.map(resource => [resource.id, resource.name])
);

const formatCost = (cost: Record<string, number>): string =>
  Object.entries(cost)
    .map(([resourceId, amount]) => `${amount} ${RESOURCE_NAME[resourceId] ?? resourceId}`)
    .join(' / ');

export const HeroCommandPanel: React.FC<HeroCommandPanelProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const { tiles } = useSelector((state: RootState) => state.world);
  const {
    currentPlayer,
    currentPhase,
    heroes,
    playerStats,
    players,
  } = useSelector((state: RootState) => state.game);
  const {
    isMultiplayer,
    sendRecruitHero,
    sendRestHero,
    sendLearnSkill,
    sendCastSpell,
    sendRecruitUnit,
    sendInitiateCombat,
  } = useMultiplayer();

  const [activeTab, setActiveTab] = useState<HeroTab>('hero');
  const [spellTargets, setSpellTargets] = useState<Record<string, string>>({});

  const currentStats = currentPlayer ? playerStats[currentPlayer.id] : null;
  const hero = currentPlayer ? heroes.find(h => h.ownerId === currentPlayer.id) ?? null : null;
  const heroClass = hero ? heroClasses[hero.classId] : null;

  const enemies = useMemo(() => {
    if (!currentPlayer) return [];
    return players.filter(player => player.id !== currentPlayer.id && player.teamId !== currentPlayer.teamId);
  }, [players, currentPlayer]);

  const adjacentEnemies = useMemo(() => {
    if (!currentPlayer) return [];
    return enemies.filter(enemy => cubeDistance(currentPlayer.position, enemy.position) <= 1);
  }, [currentPlayer, enemies]);

  const canAct = currentPhase === 'interaction' && !!currentPlayer && !!currentStats;

  const runRecruitHero = (classId: string) => {
    if (!currentPlayer) return;
    if (isMultiplayer) sendRecruitHero(currentPlayer.id, classId);
    else dispatch(recruitHero({ playerId: currentPlayer.id, classId }));
  };

  const runRest = () => {
    if (!currentPlayer) return;
    if (isMultiplayer) sendRestHero(currentPlayer.id);
    else dispatch(restHero({ playerId: currentPlayer.id }));
  };

  const runLearnSkill = (skillId: string) => {
    if (!currentPlayer) return;
    if (isMultiplayer) sendLearnSkill(currentPlayer.id, skillId);
    else dispatch(learnSkill({ playerId: currentPlayer.id, skillId }));
  };

  const runRecruitUnit = (unitId: string) => {
    if (!currentPlayer) return;
    if (isMultiplayer) sendRecruitUnit(currentPlayer.id, unitId);
    else dispatch(recruitUnit({ playerId: currentPlayer.id, unitId }));
  };

  const runCastSpell = (spellId: string, targetPlayerId?: string) => {
    if (!currentPlayer) return;
    const payload = { playerId: currentPlayer.id, spellId, targetPlayerId };
    if (isMultiplayer) sendCastSpell(payload);
    else dispatch(castSpell(payload));
  };

  const runCombat = (defenderId: string) => {
    if (!currentPlayer) return;
    if (isMultiplayer) sendInitiateCombat(currentPlayer.id, defenderId);
    else dispatch(initiateCombat({ attackerId: currentPlayer.id, defenderId, tiles }));
  };

  const tabs = [
    { id: 'hero' as HeroTab, icon: Crown, label: 'Hero' },
    { id: 'army' as HeroTab, icon: Shield, label: 'Army' },
    { id: 'skills' as HeroTab, icon: BookOpen, label: 'Skills' },
    { id: 'spells' as HeroTab, icon: Wand2, label: 'Spells' },
    { id: 'combat' as HeroTab, icon: Swords, label: 'Combat' },
  ];

  const hasRecruitCost = (classId: string) => {
    if (!currentStats || !canAct || hero || !heroClasses[classId]) return false;
    if (currentStats.actionPoints < HERO_RECRUIT_AP_COST) return false;
    return Object.entries(HERO_RECRUIT_RESOURCE_COST).every(
      ([resourceId, required]) => (currentStats.resources[resourceId] || 0) >= required
    );
  };

  const renderRecruitment = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {heroClassList.map(classData => {
          const enabled = hasRecruitCost(classData.id);
          return (
            <button
              key={classData.id}
              onClick={() => runRecruitHero(classData.id)}
              disabled={!enabled}
              className="text-left rounded-lg border border-slate-600 bg-slate-800 p-3 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{classData.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-white">{classData.name}</div>
                  <div className="text-xs text-slate-400">
                    {classData.baseStats.attack}/{classData.baseStats.defense}/{classData.baseStats.spellPower}/{classData.baseStats.knowledge}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">{classData.description}</div>
            </button>
          );
        })}
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
        Cost: {HERO_RECRUIT_AP_COST} AP / {formatCost(HERO_RECRUIT_RESOURCE_COST)}
      </div>
    </div>
  );

  const renderHero = () => {
    if (!hero || !heroClass) return renderRecruitment();
    const xpPercent = Math.min(100, Math.round((hero.xp / hero.xpToNext) * 100));
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-600/50 bg-slate-800 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-3xl">
                {heroClass.icon}
              </div>
              <div>
                <div className="text-lg font-bold text-white">{hero.name}</div>
                <div className="text-sm text-amber-300">Level {hero.level} {heroClass.name}</div>
              </div>
            </div>
            <button
              onClick={runRest}
              disabled={!canAct || !currentStats || currentStats.actionPoints < 1}
              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Rest
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <StatTile label="ATK" value={hero.attack} />
            <StatTile label="DEF" value={hero.defense + hero.defenseBuff} />
            <StatTile label="PWR" value={hero.spellPower} />
            <StatTile label="KNW" value={hero.knowledge} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Meter icon={<Heart className="h-4 w-4 text-red-400" />} value={hero.hp} max={hero.maxHp} />
            <Meter icon={<Sparkles className="h-4 w-4 text-blue-300" />} value={hero.mana} max={hero.maxMana} />
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>XP</span>
              <span>{hero.xp}/{hero.xpToNext}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div className="h-full bg-amber-400" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderArmy = () => {
    if (!hero) return renderRecruitment();
    const totalUnits = armyUnitCount(hero.army);
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          Army capacity: {totalUnits}/{MAX_ARMY_SIZE}
        </div>
        {hero.army.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {hero.army.map(stack => {
              const unit = unitsData[stack.unitId];
              return (
                <div key={stack.unitId} className="rounded-lg bg-slate-800 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{unit?.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{unit?.name ?? stack.unitId}</div>
                      <div className="text-xs text-slate-400">x{stack.count}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-2">
          {unitList.map(unit => {
            const canRecruit = canAct &&
              !!currentStats &&
              totalUnits < MAX_ARMY_SIZE &&
              currentStats.actionPoints >= unit.apCost &&
              Object.entries(unit.cost).every(([resourceId, required]) => (currentStats.resources[resourceId] || 0) >= required);
            return (
              <button
                key={unit.id}
                onClick={() => runRecruitUnit(unit.id)}
                disabled={!canRecruit}
                className="flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-800 p-3 text-left transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{unit.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{unit.name}</div>
                    <div className="text-xs text-slate-400">ATK {unit.attack} / DEF {unit.defense} / HP {unit.hp}</div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>{unit.apCost} AP</div>
                  <div>{formatCost(unit.cost)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSkills = () => {
    if (!hero) return renderRecruitment();
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          Skill points: {hero.skillPoints}
        </div>
        {skillList.map(skill => {
          const rank = hero.skills.find(s => s.skillId === skill.id)?.rank ?? 0;
          const nextRank = Math.min(skill.maxRank, rank + 1);
          const enabled = hero.skillPoints > 0 && rank < skill.maxRank;
          return (
            <button
              key={skill.id}
              onClick={() => runLearnSkill(skill.id)}
              disabled={!enabled}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-left transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{skill.icon}</span>
                  <span className="text-sm font-semibold text-white">{skill.name}</span>
                </div>
                <span className="text-xs text-slate-400">{rank}/{skill.maxRank}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{skill.description}</div>
              <div className="mt-1 text-xs text-amber-300">
                {rank >= skill.maxRank
                  ? 'Mastered'
                  : skill.rankLabel(skillEffectAtRank(skill.id, nextRank))}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderSpells = () => {
    if (!hero) return renderRecruitment();
    return (
      <div className="space-y-2">
        {spellList.filter(spell => hero.knownSpells.includes(spell.id)).map(spell => {
          const value = spellEffectValue(spell, hero.spellPower);
          const targetId = spellTargets[spell.id] ?? '';
          const availableTargets = spell.target === 'enemy'
            ? enemies.filter(enemy => cubeDistance(currentPlayer!.position, enemy.position) <= spell.range)
            : [];
          const enabled = canAct &&
            hero.mana >= spell.manaCost &&
            (spell.target === 'self' || targetId.length > 0);
          return (
            <div key={spell.id} className="rounded-lg border border-slate-600 bg-slate-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{spell.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{spell.name}</div>
                    <div className="text-xs text-slate-400">{spell.description}</div>
                    <div className="mt-1 text-xs text-blue-300">Power {value} / {spell.manaCost} mana</div>
                  </div>
                </div>
                <button
                  onClick={() => runCastSpell(spell.id, spell.target === 'enemy' ? targetId : undefined)}
                  disabled={!enabled}
                  className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Cast
                </button>
              </div>
              {spell.target === 'enemy' && (
                <select
                  value={targetId}
                  onChange={event => setSpellTargets(prev => ({ ...prev, [spell.id]: event.target.value }))}
                  className="mt-2 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Target...</option>
                  {availableTargets.map(enemy => (
                    <option key={enemy.id} value={enemy.id}>
                      Player {enemy.number} - {enemy.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCombat = () => (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
        Strike cost: {COMBAT_AP_COST} AP
      </div>
      {adjacentEnemies.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-sm text-slate-400">
          No adjacent enemies
        </div>
      ) : (
        adjacentEnemies.map(enemy => {
          const enemyHero = heroes.find(h => h.ownerId === enemy.id);
          const enabled = canAct && !!currentStats && currentStats.actionPoints >= COMBAT_AP_COST;
          return (
            <button
              key={enemy.id}
              onClick={() => runCombat(enemy.id)}
              disabled={!enabled}
              className="flex w-full items-center justify-between rounded-lg border border-red-700/50 bg-red-950/40 p-3 text-left transition-colors hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-red-300" />
                <div>
                  <div className="text-sm font-semibold text-white">Player {enemy.number} - {enemy.name}</div>
                  <div className="text-xs text-slate-400">{enemyHero ? `${enemyHero.name}, level ${enemyHero.level}` : 'No hero commander'}</div>
                </div>
              </div>
              <Swords className="h-5 w-5 text-red-300" />
            </button>
          );
        })
      )}
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'army': return renderArmy();
      case 'skills': return renderSkills();
      case 'spells': return renderSpells();
      case 'combat': return renderCombat();
      case 'hero':
      default: return renderHero();
    }
  };

  return (
    <div className="fixed left-4 top-20 z-40 flex max-h-[calc(100vh-6rem)] w-[28rem] overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl">
      <div className="flex flex-col border-r border-slate-700 bg-slate-950">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-4 transition-colors ${active ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
              title={tab.label}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-bold text-white">Hero Command</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-700 p-1 text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!currentPlayer ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-sm text-slate-400">
              No active player
            </div>
          ) : (
            renderTab()
          )}
        </div>
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded bg-slate-900 px-2 py-2">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-bold text-white">{value}</div>
  </div>
);

const Meter: React.FC<{ icon: React.ReactNode; value: number; max: number }> = ({ icon, value, max }) => (
  <div className="rounded bg-slate-900 px-3 py-2">
    <div className="mb-1 flex items-center justify-between">
      {icon}
      <span className="text-xs font-semibold text-white">{value}/{max}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
      <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  </div>
);

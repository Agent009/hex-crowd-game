import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { coordsToKey, areAdjacent, cubeDistance, CubeCoords } from '../utils/hexGrid';
import { itemDatabase } from '../data/harvestData';
import {
  maxPlayers,
  requiredTeams,
  requiredPlayersPerTeam,
  isTestMode,
  playerStartingPositions,
  teamColors,
  Player,
  Team,
  terrainData,
  disasterData,
  TerrainType
} from '../data/gameData';
import { isCraftable } from '../utils/utils';
import {
  createHero,
  grantHeroXp,
  recalcHeroDerivedStats,
  heroClasses,
  HERO_RECRUIT_AP_COST,
  HERO_RECRUIT_RESOURCE_COST,
  MAX_HEROES_PER_PLAYER,
  HERO_BASE_MANA_REGEN,
  REST_HP_PER_AP,
  REST_MANA_PER_AP,
} from '../data/heroesData';
import { skillsData, skillEffectAtRank } from '../data/skillsData';
import { spellsData, spellEffectValue } from '../data/spellsData';
import { unitsData, MAX_ARMY_SIZE, armyUnitCount } from '../data/unitsData';
import { resolveCombat, COMBAT_AP_COST, CombatSideInput } from '../game/combat';
import {
  GamePhase,
  PlayerStats,
  ActivityEvent,
  PlayerState,
  PhaseState,
  TradeProposal,
  VictoryResult,
  Hero,
  CombatResult,
} from './types';

export type { GamePhase, PlayerStats, ActivityEvent, TradeProposal, VictoryResult };

export const phaseOrder: GamePhase[] = [
  'round_start',
  'ap_renewal',
  'interaction',
  'bartering',
  'terrain_effects',
  'disaster_check',
  'elimination'
];

export const phaseDurations: Record<GamePhase, number> = {
  round_start: 5,
  ap_renewal: 5,
  interaction: 30,
  bartering: 30,
  terrain_effects: 10,
  disaster_check: 10,
  elimination: 10
};

export const phaseOverlayDurations: Record<GamePhase, number> = {
  round_start: 5,
  ap_renewal: 5,
  interaction: 5,
  bartering: 30,
  terrain_effects: 10,
  disaster_check: 10,
  elimination: 10
};

export const dismissiblePhases: GamePhase[] = [
  'ap_renewal',
  'interaction',
  'bartering',
  'terrain_effects',
  'disaster_check',
  'elimination'
];

export const getPhaseDisplayName = (phase: GamePhase): string => {
  switch (phase) {
    case 'round_start': return 'Round Start';
    case 'ap_renewal': return 'AP Renewal';
    case 'interaction': return 'Interaction Phase';
    case 'bartering': return 'Bartering Phase';
    case 'terrain_effects': return 'Terrain Effects';
    case 'disaster_check': return 'Disaster Check';
    case 'elimination': return 'Elimination Phase';
    default: return phase;
  }
};

const MAX_ACTIVITY_EVENTS = 100;

const generateTeams = (): Team[] => {
  const teams: Team[] = [];
  for (let i = 0; i < requiredTeams; i++) {
    teams.push({
      id: `team_${i + 1}`,
      name: `Team ${i + 1}`,
      color: teamColors[i],
      playerIds: [],
      score: 0
    });
  }
  return teams;
};

export interface GameState extends PlayerState, PhaseState {}

const buildInitialItemQuantities = (): { [itemId: string]: number } => {
  const quantities: { [itemId: string]: number } = {};
  itemDatabase.forEach(item => {
    quantities[item.id] = item.quantity;
  });
  return quantities;
};

const initialState: GameState = {
  players: [],
  teams: generateTeams(),
  currentPlayer: null,
  playerStats: {},
  gameMode: 'lobby',
  gameTimer: 0,
  roundNumber: 1,
  activityEvents: [],
  tradeProposals: [],
  globalItemQuantities: buildInitialItemQuantities(),
  victoryResult: null,
  heroes: [],
  selectedHeroId: null,
  lastCombatResult: null,

  currentPhase: 'round_start',
  phaseStartTime: 0,
  phaseTimer: 0,
  showPhaseOverlay: false,
};

/** Append an activity event with generated id/timestamp and trim the log. */
const pushEvent = (
  state: GameState,
  event: Omit<ActivityEvent, 'id' | 'timestamp'>
): void => {
  state.activityEvents.unshift({
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    ...event,
  });
  if (state.activityEvents.length > MAX_ACTIVITY_EVENTS) {
    state.activityEvents = state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
  }
};

const findHeroByOwner = (state: GameState, playerId: string): Hero | undefined =>
  state.heroes.find(h => h.ownerId === playerId);

const removeHeroesOfPlayer = (state: GameState, playerId: string): void => {
  state.heroes = state.heroes.filter(h => {
    if (h.ownerId !== playerId) return true;
    if (state.selectedHeroId === h.id) {
      state.selectedHeroId = null;
    }
    return false;
  });
};

const consumeItemUse = (
  playerStats: PlayerStats,
  itemId: string,
  statusMessage?: string
): boolean => {
  const itemIndex = playerStats.items.findIndex(item => item.id === itemId);

  if (itemIndex !== -1 && playerStats.items[itemIndex].availableUses > 0) {
    playerStats.items[itemIndex].availableUses -= 1;

    if (statusMessage) {
      playerStats.statusEffects.push(statusMessage);
    }

    if (playerStats.items[itemIndex].availableUses <= 0) {
      playerStats.items.splice(itemIndex, 1);
    }

    return true;
  }

  return false;
};

const applyDisasterCheck = (state: GameState, tiles: { [key: string]: import('../utils/hexGrid').HexTile }) => {
  state.activityEvents.unshift({
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    type: 'disaster',
    message: 'Applying disaster checks...',
    details: {}
  });

  const terrainPlayerCounts: { [terrain: string]: number } = {};
  const terrainTotalCounts: { [terrain: string]: number } = {};

  Object.values(tiles).forEach(tile => {
    const terrain = tile.terrain;
    terrainTotalCounts[terrain] = (terrainTotalCounts[terrain] || 0) + 1;
    if (tile.players && tile.players.length > 0) {
      terrainPlayerCounts[terrain] = (terrainPlayerCounts[terrain] || 0) + tile.players.length;
    }
  });

  Object.entries(terrainPlayerCounts).forEach(([terrain, playerCount]) => {
    const totalTiles = terrainTotalCounts[terrain] || 1;
    const disasterChance = Math.min(50, (playerCount / totalTiles) * 100);
    const disasterRoll = Math.floor(Math.random() * 100);
    const disasterOccurred = disasterRoll <= disasterChance;

    if (disasterOccurred) {
      const terrainInfo = terrainData[terrain as TerrainType];
      const possibleDisasters = terrainInfo.disasters || [];

      if (possibleDisasters.length > 0) {
        const disaster = possibleDisasters[Math.floor(Math.random() * possibleDisasters.length)];
        const disasterInfo = disasterData[disaster];

        if (disasterInfo) {
          state.activityEvents.unshift({
            id: `${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
            type: 'disaster',
            message: `${disasterInfo.name} struck ${terrain} terrain!`,
            details: {
              disaster: disasterInfo.name,
              terrain,
              affectedPlayers: state.players
                .filter(p => {
                  const tileKey = coordsToKey(p.position);
                  const tile = tiles[tileKey];
                  return tile && tile.terrain === terrain;
                })
                .map(p => p.name)
            }
          });

          state.players.forEach(player => {
            const tileKey = coordsToKey(player.position);
            const tile = tiles[tileKey];
            if (tile && tile.terrain === terrain) {
              const damage = disasterInfo.effects[terrain];
              const playerStats = state.playerStats[player.id];
              if (!playerStats) return;

              if (disaster === 'storm' && (terrain === 'lake' || terrain === 'river')) {
                const boatIndex = playerStats.items.findIndex(item => item.id === 'boat');
                if (boatIndex !== -1) {
                  playerStats.items[boatIndex].availableUses -= 1;
                  if (playerStats.items[boatIndex].availableUses <= 0) {
                    playerStats.items.splice(boatIndex, 1);
                    playerStats.hp = 0;
                    playerStats.statusEffects.push(`Boat destroyed by Storm — eliminated`);
                    state.activityEvents.unshift({
                      id: `${Date.now()}_${Math.random()}`,
                      timestamp: Date.now(),
                      type: 'disaster',
                      playerId: player.id,
                      playerName: player.name,
                      playerNumber: player.number,
                      message: `${player.name}'s boat was destroyed by the Storm and they were eliminated`,
                      details: { disaster: disasterInfo.name, terrain }
                    });
                  } else {
                    playerStats.statusEffects.push(`Boat damaged by Storm (${playerStats.items[boatIndex].availableUses} uses left)`);
                    state.activityEvents.unshift({
                      id: `${Date.now()}_${Math.random()}`,
                      timestamp: Date.now(),
                      type: 'disaster',
                      playerId: player.id,
                      playerName: player.name,
                      playerNumber: player.number,
                      message: `${player.name}'s boat was damaged by the Storm`,
                      details: { disaster: disasterInfo.name, terrain }
                    });
                  }
                } else {
                  playerStats.hp = 0;
                  playerStats.statusEffects.push(`No boat — eliminated by Storm`);
                  state.activityEvents.unshift({
                    id: `${Date.now()}_${Math.random()}`,
                    timestamp: Date.now(),
                    type: 'disaster',
                    playerId: player.id,
                    playerName: player.name,
                    playerNumber: player.number,
                    message: `${player.name} had no boat and was eliminated by the Storm`,
                    details: { disaster: disasterInfo.name, terrain }
                  });
                }
              } else if (damage < 0) {
                playerStats.hp = Math.max(0, playerStats.hp + damage);
                playerStats.statusEffects.push(`${disasterInfo.name}: ${Math.abs(damage)} damage`);

                state.activityEvents.unshift({
                  id: `${Date.now()}_${Math.random()}`,
                  timestamp: Date.now(),
                  type: 'disaster',
                  playerId: player.id,
                  playerName: player.name,
                  playerNumber: player.number,
                  message: `${player.name} took ${Math.abs(damage)} damage from ${disasterInfo.name}`,
                  details: {
                    damage: Math.abs(damage),
                    disaster: disasterInfo.name,
                    terrain
                  }
                });
              }
            }
          });
        }
      }
    }
  });

  state.activityEvents.unshift({
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    type: 'disaster',
    message: 'Finished applying disaster checks',
    details: {}
  });
};

const removeEliminatedPlayers = (
  state: GameState,
  tiles: { [key: string]: import('../utils/hexGrid').HexTile }
) => {
  state.activityEvents.unshift({
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    type: 'elimination',
    message: 'Checking eliminated players...',
    details: {}
  });

  const eliminatedPlayers = state.players.filter(player => {
    const stats = state.playerStats[player.id];
    return stats && stats.hp <= 0;
  });

  eliminatedPlayers.forEach(player => {
    state.activityEvents.unshift({
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      type: 'elimination',
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      message: `${player.name} has been eliminated (0 HP)`,
      details: {}
    });

    const team = state.teams.find(t => t.id === player.teamId);
    if (team) {
      team.playerIds = team.playerIds.filter(id => id !== player.id);
    }

    const tileKey = coordsToKey(player.position);
    const playerTile = tiles[tileKey];
    if (playerTile?.players) {
      playerTile.players = playerTile.players.filter(p => p.id !== player.id);
    }

    const playerIndex = state.players.findIndex(p => p.id === player.id);
    if (playerIndex !== -1) {
      state.players.splice(playerIndex, 1);
    }

    delete state.playerStats[player.id];
    removeHeroesOfPlayer(state, player.id);

    if (state.currentPlayer?.id === player.id) {
      state.currentPlayer = state.players.length > 0 ? state.players[0] : null;
    }
  });

  state.activityEvents.unshift({
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    type: 'elimination',
    message: eliminatedPlayers.length
      ? `${eliminatedPlayers.length} player(s) eliminated`
      : 'No players were eliminated',
    details: {}
  });

  checkVictoryConditions(state);
};

const checkVictoryConditions = (state: GameState) => {
  if (state.players.length === 0) return;

  const teamsWithActivePlayers = state.teams.filter(team =>
    team.playerIds.length > 0 &&
    team.playerIds.some(id => state.players.find(p => p.id === id))
  );

  let victory: VictoryResult | null = null;

  if (state.players.length === 1) {
    const winner = state.players[0];
    const winnerTeam = state.teams.find(t => t.id === winner.teamId);
    victory = {
      winnerId: winner.id,
      winnerName: winner.name,
      winnerTeamId: winnerTeam?.id ?? null,
      winnerTeamName: winnerTeam?.name ?? null,
      isTeamVictory: false,
      roundNumber: state.roundNumber,
      survivingPlayers: [winner.name],
    };
  } else if (teamsWithActivePlayers.length === 1) {
    const winningTeam = teamsWithActivePlayers[0];
    const survivingPlayers = state.players
      .filter(p => p.teamId === winningTeam.id)
      .map(p => p.name);
    victory = {
      winnerId: null,
      winnerName: null,
      winnerTeamId: winningTeam.id,
      winnerTeamName: winningTeam.name,
      isTeamVictory: true,
      roundNumber: state.roundNumber,
      survivingPlayers,
    };
  }

  if (victory) {
    state.victoryResult = victory;
    state.gameMode = 'ended';

    const winnerLabel = victory.isTeamVictory
      ? `${victory.winnerTeamName} wins!`
      : `${victory.winnerName} wins!`;

    state.activityEvents.unshift({
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      type: 'victory',
      message: `Victory! ${winnerLabel} All other players have been eliminated.`,
      details: {}
    });
  }
};

const advanceToNextRound = (state: GameState) => {
  state.roundNumber += 1;
  state.activityEvents.unshift({
    id: `${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    type: 'round_start',
    message: `Round ${state.roundNumber} begins`,
    details: {}
  });
  state.activityEvents = state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    joinGame: (state, action: PayloadAction<{ playerName: string; playerId?: string }>) => {
      const { playerName, playerId } = action.payload;

      if (state.players.length >= maxPlayers) return;

      const usedNumbers = new Set(state.players.map(p => p.number));
      let playerNumber = 1;
      while (usedNumbers.has(playerNumber) && playerNumber <= maxPlayers) {
        playerNumber++;
      }
      if (playerNumber > maxPlayers) return;

      const teamPlayerCounts = state.teams.map(team => ({ team, count: team.playerIds.length }));
      teamPlayerCounts.sort((a, b) => a.count - b.count);
      const assignedTeam = teamPlayerCounts[0].team;

      const newPlayer: Player = {
        id: playerId ?? `player_${Date.now()}_${Math.random()}`,
        name: playerName,
        number: playerNumber,
        teamId: assignedTeam.id,
        color: assignedTeam.color,
        position: playerStartingPositions[playerNumber - 1],
        isReady: isTestMode,
        isConnected: true
      };

      state.players.push(newPlayer);
      assignedTeam.playerIds.push(newPlayer.id);

      if (!state.currentPlayer) {
        state.currentPlayer = newPlayer;
      }

      state.playerStats[newPlayer.id] = {
        hp: 10,
        actionPoints: 0,
        coins: 0,
        resources: {},
        items: [],
        crests: 0,
        statusEffects: []
      };
    },

    leaveGame: (state, action: PayloadAction<{ playerId: string }>) => {
      const { playerId } = action.payload;
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return;

      const player = state.players[playerIndex];

      const team = state.teams.find(t => t.id === player.teamId);
      if (team) {
        team.playerIds = team.playerIds.filter(id => id !== playerId);
      }

      state.players.splice(playerIndex, 1);
      delete state.playerStats[playerId];
      removeHeroesOfPlayer(state, playerId);

      if (state.currentPlayer?.id === playerId) {
        state.currentPlayer = state.players.length > 0 ? state.players[0] : null;
      }
    },

    togglePlayerReady: (state, action: PayloadAction<{ playerId: string }>) => {
      const player = state.players.find(p => p.id === action.payload.playerId);
      if (player) {
        player.isReady = !player.isReady;
      }
    },

    startGame: (state) => {
      const teamsWithPlayers = state.teams.filter(t => t.playerIds.length >= requiredPlayersPerTeam);
      const hasRequiredTeams = teamsWithPlayers.length >= requiredTeams;
      const allPlayersReady = state.players.every(p => p.isReady);

      const canStart = isTestMode
        ? (state.players.length >= 2 && allPlayersReady)
        : (hasRequiredTeams && allPlayersReady);

      if (canStart) {
        state.gameMode = 'playing';
        state.gameTimer = 0;
        state.roundNumber = 1;
        state.currentPhase = 'round_start';
        state.phaseStartTime = Date.now();
        state.phaseTimer = phaseDurations.round_start;
        state.showPhaseOverlay = true;

        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'round_start',
          message: `Game started! Round ${state.roundNumber} begins`,
          details: {}
        });
      }
    },

    endGame: (state) => {
      state.gameMode = 'ended';
    },

    movePlayer: (state, action: PayloadAction<{
      playerId: string;
      target: CubeCoords;
      tiles: { [key: string]: import('../utils/hexGrid').HexTile };
    }>) => {
      const { playerId, target, tiles } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];

      if (!player || !playerStats) return;
      if (state.currentPhase !== 'interaction') return;
      if (!areAdjacent(player.position, target)) return;

      const targetTileKey = coordsToKey(target);
      const targetTile = tiles[targetTileKey];
      if (!targetTile) return;

      const currentTileKey = coordsToKey(player.position);
      const currentTile = tiles[currentTileKey];
      if (currentTile) {
        const currentTerrain = terrainData[currentTile.terrain];
        if (currentTerrain.requiredItem === 'climbing_gear') {
          const hasGear = playerStats.items.some(
            item => item.id === 'climbing_gear' && item.availableUses > 0
          );
          if (!hasGear) return;
        }
      }

      const terrain = terrainData[targetTile.terrain];
      let movementCost = terrain.moveCost;
      let itemUsed = false;

      if (terrain.requiredItem) {
        if (consumeItemUse(playerStats, terrain.requiredItem, `Used ${terrain.requiredItem}`)) {
          itemUsed = true;
        } else {
          movementCost = terrain.alternativeAPCost || (terrain.moveCost + 1);
        }
      }

      // The player's hero travels with them (H7); a hero skilled in
      // logistics makes the journey cheaper.
      const movingHero = findHeroByOwner(state, playerId);
      if (movingHero) {
        const logisticsRank = movingHero.skills.find(s => s.skillId === 'logistics')?.rank ?? 0;
        const discount = skillEffectAtRank('logistics', logisticsRank);
        movementCost = Math.max(1, movementCost - discount);
      }

      if (playerStats.actionPoints < movementCost) return;

      playerStats.actionPoints -= movementCost;

      if (itemUsed) {
        playerStats.statusEffects.push(`Used ${terrain.requiredItem}`);
        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'item_usage',
          playerId,
          playerName: player.name,
          playerNumber: player.number,
          message: `${player.name} used ${terrain.requiredItem?.replace('_', ' ')} to move`,
          details: { item: terrain.requiredItem?.replace('_', ' ') }
        });
      }

      player.position = target;

      const newTile = tiles[coordsToKey(target)];
      if (newTile) {
        const moveTerrain = terrainData[newTile.terrain];
        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'movement',
          playerId,
          playerName: player.name,
          playerNumber: player.number,
          message: `${player.name} moved to tile (${target.q}, ${target.r}, ${target.s}) (${moveTerrain.name})`,
          details: { coords: target, terrain: moveTerrain.name }
        });
      }
    },

    updateGameTimer: (state, action: PayloadAction<number>) => {
      state.gameTimer = action.payload;
    },

    updatePhaseTimer: (state, action: PayloadAction<{ tiles: { [key: string]: import('../utils/hexGrid').HexTile } }>) => {
      const { tiles } = action.payload;

      if (state.phaseTimer > 0) {
        state.phaseTimer -= 1;
      }

      if (state.phaseTimer <= 0) {
        const currentIndex = phaseOrder.indexOf(state.currentPhase);
        const nextIndex = (currentIndex + 1) % phaseOrder.length;

        if (nextIndex === 0) {
          advanceToNextRound(state);
        }

        const nextPhase = phaseOrder[nextIndex];
        state.currentPhase = nextPhase;
        state.phaseStartTime = Date.now();
        state.phaseTimer = phaseDurations[nextPhase];
        state.showPhaseOverlay = true;

        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'phase_change',
          message: `Entering [${getPhaseDisplayName(nextPhase)}]`,
          details: {}
        });

        const apIncrement = 2;
        switch (state.currentPhase) {
          case 'ap_renewal':
            state.players.forEach(player => {
              if (state.playerStats[player.id]) {
                state.playerStats[player.id].actionPoints += apIncrement;
                state.playerStats[player.id].statusEffects = [];
              }
            });
            // Heroes recover mana and shed temporary combat buffs.
            state.heroes.forEach(hero => {
              const mysticismRank = hero.skills.find(s => s.skillId === 'mysticism')?.rank ?? 0;
              const regen = HERO_BASE_MANA_REGEN + skillEffectAtRank('mysticism', mysticismRank);
              hero.mana = Math.min(hero.maxMana, hero.mana + regen);
              hero.defenseBuff = 0;
            });
            state.activityEvents.unshift({
              id: `${Date.now()}_${Math.random()}`,
              timestamp: Date.now(),
              type: 'phase_effect',
              subtype: 'ap_renewal',
              message: `+${apIncrement} AP to all players`,
              details: {}
            });
            break;

          case 'terrain_effects':
            state.activityEvents.unshift({
              id: `${Date.now()}_${Math.random()}`,
              timestamp: Date.now(),
              type: 'terrain_effect',
              message: 'Applying terrain effects...',
              details: {}
            });
            state.players.forEach(player => {
              const playerStats = state.playerStats[player.id];
              if (!playerStats) return;

              const tileKey = coordsToKey(player.position);
              const tile = tiles[tileKey];
              if (!tile) return;

              const terrain = terrainData[tile.terrain];
              const effects = terrain.effects;
              let statusMessage = null;

              if (effects?.hpGainPerRound && effects.hpGainPerRound.length > 0) {
                for (const effectEntry of effects.hpGainPerRound) {
                  for (const effectData of Object.values(effectEntry)) {
                    if (Math.random() * 100 < effectData.chance) {
                      const gain = Math.floor(Math.random() * (effectData.max - effectData.min + 1)) + effectData.min;
                      const prevHp = playerStats.hp;
                      playerStats.hp = Math.min(10, playerStats.hp + gain);
                      const actualGain = playerStats.hp - prevHp;
                      if (actualGain > 0) {
                        playerStats.statusEffects.push(`+${actualGain} HP (plains)`);
                        state.activityEvents.unshift({
                          id: `${Date.now()}_${Math.random()}`,
                          timestamp: Date.now(),
                          type: 'healing',
                          playerId: player.id,
                          playerName: player.name,
                          playerNumber: player.number,
                          message: `${player.name || 'Unknown'} recovered ${actualGain} HP resting on plains`,
                          details: { healing: actualGain, terrain: terrain.name }
                        });
                      }
                    }
                  }
                }
              }

              if (effects?.hpLossPerRound) {
                let takeDamage = effects.hpLossPerRound;

                if (effects.protectionItem) {
                  statusMessage = `Consumed ${effects.protectionItem} to reduce ${terrain.name} damage`;
                  if (consumeItemUse(playerStats, effects.protectionItem, statusMessage)) {
                    takeDamage -= 1;
                    state.activityEvents.unshift({
                      id: `${Date.now()}_${Math.random()}`,
                      timestamp: Date.now(),
                      type: 'item_usage',
                      subtype: 'terrain_effect',
                      message: `${player.name || 'Unknown'} ${statusMessage}`,
                      details: {}
                    });
                  }
                }

                if (effects.protectionResource && takeDamage) {
                  const resourceAmount = playerStats.resources[effects.protectionResource] || 0;
                  if (resourceAmount > 0) {
                    playerStats.resources[effects.protectionResource] -= 1;
                    takeDamage = 0;
                    statusMessage = `Consumed ${effects.protectionResource} to prevent ${terrain.name} damage`;
                    playerStats.statusEffects.push(statusMessage);
                    state.activityEvents.unshift({
                      id: `${Date.now()}_${Math.random()}`,
                      timestamp: Date.now(),
                      type: 'item_usage',
                      subtype: 'terrain_effect',
                      message: `${player.name || 'Unknown'} ${statusMessage}`,
                      details: {}
                    });
                  }
                }

                if (takeDamage) {
                  playerStats.hp = Math.max(0, playerStats.hp - takeDamage);
                  statusMessage = `Lost ${Math.abs(takeDamage)} HP from ${terrain.name}`;
                  playerStats.statusEffects.push(statusMessage);
                  state.activityEvents.unshift({
                    id: `${Date.now()}_${Math.random()}`,
                    timestamp: Date.now(),
                    type: 'terrain_effect',
                    playerId: player.id,
                    playerName: player.name,
                    playerNumber: player.number,
                    message: `${player.name || 'Unknown'} ${statusMessage}`,
                    details: { damage: Math.abs(takeDamage), terrain: terrain.name, coords: player.position }
                  });
                }
              }
            });
            state.activityEvents.unshift({
              id: `${Date.now()}_${Math.random()}`,
              timestamp: Date.now(),
              type: 'terrain_effect',
              message: 'Finished applying terrain effects',
              details: {}
            });
            break;

          case 'disaster_check':
            applyDisasterCheck(state, tiles);
            break;

          case 'elimination':
            removeEliminatedPlayers(state, tiles);
            break;

          default:
            break;
        }
      }
    },

    dismissPhaseOverlay: (state) => {
      if (dismissiblePhases.includes(state.currentPhase)) {
        state.showPhaseOverlay = false;
      }
    },

    forceNextPhase: (state) => {
      state.phaseTimer = 0;
    },

    nextRound: (state) => {
      advanceToNextRound(state);
    },

    harvestFromTile: (state, action: PayloadAction<{
      playerId: string;
      tileCoords: CubeCoords;
      resourceId?: string;
      itemId?: string;
      isItem: boolean;
      tiles: { [key: string]: import('../utils/hexGrid').HexTile };
      activeTiles: string[];
    }>) => {
      const { playerId, tileCoords, resourceId, itemId, isItem, tiles, activeTiles } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];
      const tileKey = coordsToKey(tileCoords);
      const tile = tiles[tileKey];

      if (!player || !playerStats || !tile) return;
      if (state.currentPhase !== 'interaction') return;

      const isPlayerOnTile = tile.players?.some(p => p.id === playerId);
      if (!isPlayerOnTile) return;
      if (!activeTiles.includes(tileKey)) return;

      const apCost = isItem ? 3 : 1;
      if (playerStats.actionPoints < apCost) return;

      playerStats.actionPoints -= apCost;

      if (isItem && itemId) {
        const globalRemaining = state.globalItemQuantities[itemId] ?? 0;
        if (globalRemaining <= 0) return;

        const itemTemplate = itemDatabase.find(item => item.id === itemId);
        if (itemTemplate) {
          const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
          playerStats.items.push({ ...itemTemplate, availableUses: uses });
          state.globalItemQuantities[itemId] = globalRemaining - 1;

          state.activityEvents.unshift({
            id: `${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
            type: 'harvesting',
            playerId,
            playerName: player.name,
            playerNumber: player.number,
            message: `${player.name} harvested ${itemTemplate.name} (${state.globalItemQuantities[itemId]} remaining)`,
            details: { item: itemTemplate.name }
          });
        }
      } else if (resourceId) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) + 1;

        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'harvesting',
          playerId,
          playerName: player.name,
          playerNumber: player.number,
          message: `${player.name} harvested ${resourceId}`,
          details: { resource: resourceId }
        });
      }

      state.activityEvents = state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
    },

    setCurrentPlayer: (state, action: PayloadAction<{ playerId: string }>) => {
      const player = state.players.find(p => p.id === action.payload.playerId);
      if (player) {
        state.currentPlayer = player;
      }
    },

    updateTeamScore: (state, action: PayloadAction<{ teamId: string; points: number }>) => {
      const team = state.teams.find(t => t.id === action.payload.teamId);
      if (team) {
        team.score += action.payload.points;
      }
    },

    activateItemEffect: (state, action: PayloadAction<{
      playerId: string;
      itemId: string;
    }>) => {
      const { playerId, itemId } = action.payload;
      const playerStats = state.playerStats[playerId];
      const player = state.players.find(p => p.id === playerId);

      if (!player || !playerStats) return;
      if (state.currentPhase !== 'interaction') return;

      const itemIndex = playerStats.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1 || playerStats.items[itemIndex].availableUses <= 0) return;

      const item = playerStats.items[itemIndex];

      if (itemId === 'rejuvenate') {
        const prevHp = playerStats.hp;
        playerStats.hp = Math.min(10, playerStats.hp + 3);
        const actualGain = playerStats.hp - prevHp;
        playerStats.statusEffects.push(`+${actualGain} HP (Rejuvenate)`);
        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'healing',
          playerId,
          playerName: player.name,
          playerNumber: player.number,
          message: `${player.name} used Rejuvenate and recovered ${actualGain} HP`,
          details: { healing: actualGain, item: item.name }
        });
        playerStats.items.splice(itemIndex, 1);
      } else if (itemId === 'armageddon') {
        state.players.forEach(target => {
          if (target.id === playerId) return;
          const targetStats = state.playerStats[target.id];
          if (!targetStats) return;
          targetStats.hp = Math.max(0, targetStats.hp - 2);
          targetStats.statusEffects.push(`-2 HP (Armageddon by ${player.name})`);
          state.activityEvents.unshift({
            id: `${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
            type: 'damage',
            playerId: target.id,
            playerName: target.name,
            playerNumber: target.number,
            message: `${target.name} took 2 damage from ${player.name}'s Armageddon`,
            details: { damage: 2, item: item.name }
          });
        });
        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'item_usage',
          playerId,
          playerName: player.name,
          playerNumber: player.number,
          message: `${player.name} unleashed Armageddon! All other players take 2 damage`,
          details: { item: item.name }
        });
        playerStats.items.splice(itemIndex, 1);
      } else if (itemId === 'terraform' || itemId === 'leech') {
        playerStats.items.splice(itemIndex, 1);
        state.activityEvents.unshift({
          id: `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          type: 'item_usage',
          playerId,
          playerName: player.name,
          playerNumber: player.number,
          message: `${player.name} used ${item.name}`,
          details: { item: item.name }
        });
      }

      state.activityEvents = state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
    },

    craftItem: (state, action: PayloadAction<{ playerId: string; itemId: string }>) => {
      const { playerId, itemId } = action.payload;
      const playerStats = state.playerStats[playerId];
      const player = state.players.find(p => p.id === playerId);

      if (!player || !playerStats) return;
      if (state.currentPhase !== 'interaction') return;

      const itemTemplate = itemDatabase.find(item => item.id === itemId);
      if (!itemTemplate || !isCraftable(itemTemplate)) return;

      const globalRemaining = state.globalItemQuantities[itemId] ?? 0;
      if (globalRemaining <= 0) return;

      for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
        if ((playerStats.resources[resourceId] || 0) < required) return;
      }

      for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) - required;
      }

      const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
      playerStats.items.push({ ...itemTemplate, availableUses: uses });
      state.globalItemQuantities[itemId] = globalRemaining - 1;

      state.activityEvents.unshift({
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        type: 'crafting',
        playerId,
        playerName: player.name,
        playerNumber: player.number,
        message: `${player.name} crafted ${itemTemplate.name}`,
        details: { item: itemTemplate.name }
      });

      state.activityEvents = state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
    },

    proposeTrade: (state, action: PayloadAction<{
      fromPlayerId: string;
      toPlayerId: string;
      offeredResources: { [resourceId: string]: number };
      requestedResources: { [resourceId: string]: number };
    }>) => {
      const { fromPlayerId, toPlayerId, offeredResources, requestedResources } = action.payload;
      if (state.currentPhase !== 'bartering') return;

      const fromPlayer = state.players.find(p => p.id === fromPlayerId);
      const toPlayer = state.players.find(p => p.id === toPlayerId);
      const fromStats = state.playerStats[fromPlayerId];
      if (!fromPlayer || !toPlayer || !fromStats) return;

      for (const [resourceId, amount] of Object.entries(offeredResources)) {
        if ((fromStats.resources[resourceId] || 0) < amount) return;
      }

      const proposal: TradeProposal = {
        id: `trade_${Date.now()}_${Math.random()}`,
        fromPlayerId,
        toPlayerId,
        offeredResources,
        requestedResources,
        status: 'pending',
        createdAt: Date.now(),
      };

      state.tradeProposals.push(proposal);

      const offerSummary = Object.entries(offeredResources)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      const requestSummary = Object.entries(requestedResources)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');

      state.activityEvents.unshift({
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        type: 'trade',
        playerId: fromPlayerId,
        playerName: fromPlayer.name,
        playerNumber: fromPlayer.number,
        message: `${fromPlayer.name} proposed a trade to ${toPlayer.name}: offer [${offerSummary}] for [${requestSummary}]`,
        details: {}
      });
    },

    acceptTrade: (state, action: PayloadAction<{ tradeId: string; acceptingPlayerId: string }>) => {
      const { tradeId, acceptingPlayerId } = action.payload;
      if (state.currentPhase !== 'bartering') return;

      const proposal = state.tradeProposals.find(t => t.id === tradeId);
      if (!proposal || proposal.status !== 'pending') return;
      if (proposal.toPlayerId !== acceptingPlayerId) return;

      const fromStats = state.playerStats[proposal.fromPlayerId];
      const toStats = state.playerStats[proposal.toPlayerId];
      if (!fromStats || !toStats) return;

      for (const [resourceId, amount] of Object.entries(proposal.offeredResources)) {
        if ((fromStats.resources[resourceId] || 0) < amount) {
          proposal.status = 'cancelled';
          return;
        }
      }
      for (const [resourceId, amount] of Object.entries(proposal.requestedResources)) {
        if ((toStats.resources[resourceId] || 0) < amount) {
          proposal.status = 'cancelled';
          return;
        }
      }

      for (const [resourceId, amount] of Object.entries(proposal.offeredResources)) {
        fromStats.resources[resourceId] = (fromStats.resources[resourceId] || 0) - amount;
        toStats.resources[resourceId] = (toStats.resources[resourceId] || 0) + amount;
      }
      for (const [resourceId, amount] of Object.entries(proposal.requestedResources)) {
        toStats.resources[resourceId] = (toStats.resources[resourceId] || 0) - amount;
        fromStats.resources[resourceId] = (fromStats.resources[resourceId] || 0) + amount;
      }

      proposal.status = 'accepted';

      const fromPlayer = state.players.find(p => p.id === proposal.fromPlayerId);
      const toPlayer = state.players.find(p => p.id === proposal.toPlayerId);

      state.activityEvents.unshift({
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        type: 'trade',
        playerId: acceptingPlayerId,
        playerName: toPlayer?.name,
        playerNumber: toPlayer?.number,
        message: `${toPlayer?.name} accepted ${fromPlayer?.name}'s trade proposal`,
        details: {}
      });
      state.activityEvents = state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
    },

    rejectTrade: (state, action: PayloadAction<{ tradeId: string; rejectingPlayerId: string }>) => {
      const { tradeId, rejectingPlayerId } = action.payload;
      const proposal = state.tradeProposals.find(t => t.id === tradeId);
      if (!proposal || proposal.status !== 'pending') return;
      if (proposal.toPlayerId !== rejectingPlayerId) return;

      proposal.status = 'rejected';

      const fromPlayer = state.players.find(p => p.id === proposal.fromPlayerId);
      const toPlayer = state.players.find(p => p.id === proposal.toPlayerId);

      state.activityEvents.unshift({
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        type: 'trade',
        playerId: rejectingPlayerId,
        playerName: toPlayer?.name,
        playerNumber: toPlayer?.number,
        message: `${toPlayer?.name} rejected ${fromPlayer?.name}'s trade proposal`,
        details: {}
      });
    },

    cancelTrade: (state, action: PayloadAction<{ tradeId: string; cancellingPlayerId: string }>) => {
      const { tradeId, cancellingPlayerId } = action.payload;
      const proposal = state.tradeProposals.find(t => t.id === tradeId);
      if (!proposal || proposal.status !== 'pending') return;
      if (proposal.fromPlayerId !== cancellingPlayerId) return;

      proposal.status = 'cancelled';
    },

    selectHero: (state, action: PayloadAction<{ heroId: string | null }>) => {
      const { heroId } = action.payload;
      if (heroId === null) {
        state.selectedHeroId = null;
        return;
      }
      if (state.heroes.some(h => h.id === heroId)) {
        state.selectedHeroId = heroId;
      }
    },

    recruitHero: (state, action: PayloadAction<{ playerId: string; classId: string }>) => {
      const { playerId, classId } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];
      const classData = heroClasses[classId];

      if (!player || !playerStats || !classData) return;
      if (state.currentPhase !== 'interaction') return;

      const ownedHeroes = state.heroes.filter(h => h.ownerId === playerId).length;
      if (ownedHeroes >= MAX_HEROES_PER_PLAYER) return;

      if (playerStats.actionPoints < HERO_RECRUIT_AP_COST) return;
      for (const [resourceId, required] of Object.entries(HERO_RECRUIT_RESOURCE_COST)) {
        if ((playerStats.resources[resourceId] || 0) < required) return;
      }

      playerStats.actionPoints -= HERO_RECRUIT_AP_COST;
      for (const [resourceId, required] of Object.entries(HERO_RECRUIT_RESOURCE_COST)) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) - required;
      }

      const heroId = `hero_${Date.now()}_${Math.random()}`;
      const hero = createHero(classId, playerId, heroId, player.number);
      if (!hero) return;

      state.heroes.push(hero);
      state.selectedHeroId = hero.id;

      pushEvent(state, {
        type: 'hero',
        playerId,
        playerName: player.name,
        playerNumber: player.number,
        message: `${player.name} recruited ${hero.name} the ${classData.name}!`,
        details: { hero: hero.name },
      });
    },

    restHero: (state, action: PayloadAction<{ playerId: string }>) => {
      const { playerId } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];
      const hero = findHeroByOwner(state, playerId);

      if (!player || !playerStats || !hero) return;
      if (state.currentPhase !== 'interaction') return;
      if (playerStats.actionPoints < 1) return;

      const apSpent = playerStats.actionPoints;
      playerStats.actionPoints = 0;

      const hpBefore = hero.hp;
      const manaBefore = hero.mana;
      hero.hp = Math.min(hero.maxHp, hero.hp + apSpent * REST_HP_PER_AP);
      hero.mana = Math.min(hero.maxMana, hero.mana + apSpent * REST_MANA_PER_AP);

      const hpGain = hero.hp - hpBefore;
      const manaGain = hero.mana - manaBefore;
      playerStats.statusEffects.push(`${hero.name} rested (+${hpGain} HP, +${manaGain} mana)`);

      pushEvent(state, {
        type: 'hero',
        playerId,
        playerName: player.name,
        playerNumber: player.number,
        message: `${hero.name} rested for ${apSpent} AP, recovering ${hpGain} HP and ${manaGain} mana`,
        details: { hero: hero.name, healing: hpGain },
      });
    },

    learnSkill: (state, action: PayloadAction<{ playerId: string; skillId: string }>) => {
      const { playerId, skillId } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const hero = findHeroByOwner(state, playerId);
      const skillData = skillsData[skillId];

      if (!player || !hero || !skillData) return;
      if (hero.skillPoints < 1) return;

      const existing = hero.skills.find(s => s.skillId === skillId);
      if (existing) {
        if (existing.rank >= skillData.maxRank) return;
        existing.rank += 1;
      } else {
        hero.skills.push({ skillId, rank: 1 });
      }

      hero.skillPoints -= 1;
      recalcHeroDerivedStats(hero);

      const rank = hero.skills.find(s => s.skillId === skillId)?.rank ?? 1;
      pushEvent(state, {
        type: 'hero',
        playerId,
        playerName: player.name,
        playerNumber: player.number,
        message: `${hero.name} learned ${skillData.name} (rank ${rank})`,
        details: { hero: hero.name, skill: skillData.name },
      });
    },

    castSpell: (state, action: PayloadAction<{
      playerId: string;
      spellId: string;
      targetPlayerId?: string;
    }>) => {
      const { playerId, spellId, targetPlayerId } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];
      const hero = findHeroByOwner(state, playerId);
      const spell = spellsData[spellId];

      if (!player || !playerStats || !hero || !spell) return;
      if (state.currentPhase !== 'interaction') return;
      if (!hero.knownSpells.includes(spellId)) return;
      if (hero.mana < spell.manaCost) return;

      const value = spellEffectValue(spell, hero.spellPower);

      if (spell.target === 'enemy') {
        if (!targetPlayerId) return;
        const target = state.players.find(p => p.id === targetPlayerId);
        const targetStats = state.playerStats[targetPlayerId];
        if (!target || !targetStats) return;
        if (target.teamId === player.teamId) return;
        if (cubeDistance(player.position, target.position) > spell.range) return;

        hero.mana -= spell.manaCost;

        targetStats.hp = Math.max(0, targetStats.hp - value);
        targetStats.statusEffects.push(`${spell.name}: ${value} damage from ${hero.name}`);

        pushEvent(state, {
          type: 'hero',
          playerId: target.id,
          playerName: target.name,
          playerNumber: target.number,
          message: `${hero.name} cast ${spell.name} on ${target.name} for ${value} damage!`,
          details: { hero: hero.name, spell: spell.name, damage: value },
        });

        if (spell.kind === 'drain') {
          const hpBefore = playerStats.hp;
          playerStats.hp = Math.min(10, playerStats.hp + value);
          const healed = playerStats.hp - hpBefore;
          if (healed > 0) {
            pushEvent(state, {
              type: 'healing',
              playerId,
              playerName: player.name,
              playerNumber: player.number,
              message: `${player.name} drained ${healed} HP from ${target.name}`,
              details: { hero: hero.name, spell: spell.name, healing: healed },
            });
          }
        }
        return;
      }

      // Self-targeted spells
      hero.mana -= spell.manaCost;

      switch (spell.kind) {
        case 'heal': {
          const hpBefore = playerStats.hp;
          playerStats.hp = Math.min(10, playerStats.hp + value);
          const healed = playerStats.hp - hpBefore;
          playerStats.statusEffects.push(`+${healed} HP (${spell.name})`);
          pushEvent(state, {
            type: 'healing',
            playerId,
            playerName: player.name,
            playerNumber: player.number,
            message: `${hero.name} cast ${spell.name}, restoring ${healed} HP to ${player.name}`,
            details: { hero: hero.name, spell: spell.name, healing: healed },
          });
          break;
        }
        case 'buff': {
          hero.defenseBuff += value;
          playerStats.statusEffects.push(`${spell.name}: +${value} defense until next round`);
          pushEvent(state, {
            type: 'hero',
            playerId,
            playerName: player.name,
            playerNumber: player.number,
            message: `${hero.name} cast ${spell.name} (+${value} defense until next round)`,
            details: { hero: hero.name, spell: spell.name },
          });
          break;
        }
        case 'energize': {
          playerStats.actionPoints += value;
          playerStats.statusEffects.push(`+${value} AP (${spell.name})`);
          pushEvent(state, {
            type: 'hero',
            playerId,
            playerName: player.name,
            playerNumber: player.number,
            message: `${hero.name} cast ${spell.name}, granting ${player.name} +${value} AP`,
            details: { hero: hero.name, spell: spell.name },
          });
          break;
        }
        default:
          break;
      }
    },

    recruitUnit: (state, action: PayloadAction<{ playerId: string; unitId: string }>) => {
      const { playerId, unitId } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];
      const hero = findHeroByOwner(state, playerId);
      const unit = unitsData[unitId];

      if (!player || !playerStats || !hero || !unit) return;
      if (state.currentPhase !== 'interaction') return;
      if (playerStats.actionPoints < unit.apCost) return;
      if (armyUnitCount(hero.army) >= MAX_ARMY_SIZE) return;

      for (const [resourceId, required] of Object.entries(unit.cost)) {
        if ((playerStats.resources[resourceId] || 0) < required) return;
      }

      playerStats.actionPoints -= unit.apCost;
      for (const [resourceId, required] of Object.entries(unit.cost)) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) - required;
      }

      const stack = hero.army.find(s => s.unitId === unitId);
      if (stack) {
        stack.count += 1;
      } else {
        hero.army.push({ unitId, count: 1 });
      }

      pushEvent(state, {
        type: 'hero',
        playerId,
        playerName: player.name,
        playerNumber: player.number,
        message: `${player.name} recruited a ${unit.name} for ${hero.name}'s army`,
        details: { hero: hero.name, unit: unit.name },
      });
    },

    initiateCombat: (state, action: PayloadAction<{
      attackerId: string;
      defenderId: string;
      tiles: { [key: string]: import('../utils/hexGrid').HexTile };
    }>) => {
      const { attackerId, defenderId, tiles } = action.payload;
      if (state.currentPhase !== 'interaction') return;
      if (attackerId === defenderId) return;

      const attacker = state.players.find(p => p.id === attackerId);
      const defender = state.players.find(p => p.id === defenderId);
      const attackerStats = state.playerStats[attackerId];
      const defenderStats = state.playerStats[defenderId];

      if (!attacker || !defender || !attackerStats || !defenderStats) return;
      if (attacker.teamId === defender.teamId) return;
      if (cubeDistance(attacker.position, defender.position) > 1) return;
      if (attackerStats.actionPoints < COMBAT_AP_COST) return;

      attackerStats.actionPoints -= COMBAT_AP_COST;

      const attackerHero = findHeroByOwner(state, attackerId) ?? null;
      const defenderHero = findHeroByOwner(state, defenderId) ?? null;

      const defenderTile = tiles[coordsToKey(defender.position)];
      const defenderTerrain = defenderTile ? terrainData[defenderTile.terrain] : null;

      const attackerSide: CombatSideInput = {
        playerId: attackerId,
        playerHp: attackerStats.hp,
        hero: attackerHero,
        terrainDefenseBonus: 0,
      };
      const defenderSide: CombatSideInput = {
        playerId: defenderId,
        playerHp: defenderStats.hp,
        hero: defenderHero,
        terrainDefenseBonus: defenderTerrain?.defenseBonus ?? 0,
      };

      const outcome = resolveCombat(attackerSide, defenderSide);

      pushEvent(state, {
        type: 'combat',
        playerId: attackerId,
        playerName: attacker.name,
        playerNumber: attacker.number,
        message: `${attacker.name} attacked ${defender.name}! (${outcome.attackerPower} vs ${outcome.defenderPower})`,
        details: { coords: defender.position, damage: outcome.damageToDefender },
      });

      // Apply army losses, hero damage, and player HP damage to one side.
      const applyReport = (
        report: typeof outcome.attackerReport,
        hero: Hero | null,
        stats: PlayerStats,
        sidePlayer: Player
      ) => {
        if (hero) {
          report.armyLosses.forEach(loss => {
            const stack = hero.army.find(s => s.unitId === loss.unitId);
            if (stack) {
              stack.count -= loss.count;
            }
            const unit = unitsData[loss.unitId];
            pushEvent(state, {
              type: 'combat',
              playerId: sidePlayer.id,
              playerName: sidePlayer.name,
              playerNumber: sidePlayer.number,
              message: `${sidePlayer.name} lost ${loss.count} ${unit?.name ?? loss.unitId}${loss.count > 1 ? 's' : ''} in battle`,
              details: { unit: unit?.name },
            });
          });
          hero.army = hero.army.filter(s => s.count > 0);

          if (report.heroHpLoss > 0) {
            hero.hp = Math.max(0, hero.hp - report.heroHpLoss);
          }
          if (report.heroLost) {
            pushEvent(state, {
              type: 'combat',
              playerId: sidePlayer.id,
              playerName: sidePlayer.name,
              playerNumber: sidePlayer.number,
              message: `${hero.name} has fallen in battle!`,
              details: { hero: hero.name },
            });
            removeHeroesOfPlayer(state, sidePlayer.id);
          }
        }

        if (report.playerHpDamage > 0) {
          stats.hp = Math.max(0, stats.hp - report.playerHpDamage);
          stats.statusEffects.push(`-${report.playerHpDamage} HP (combat)`);
          pushEvent(state, {
            type: 'damage',
            playerId: sidePlayer.id,
            playerName: sidePlayer.name,
            playerNumber: sidePlayer.number,
            message: `${sidePlayer.name} took ${report.playerHpDamage} damage in combat`,
            details: { damage: report.playerHpDamage },
          });
        }
      };

      applyReport(outcome.defenderReport, defenderHero, defenderStats, defender);
      applyReport(outcome.attackerReport, attackerHero, attackerStats, attacker);

      // Surviving heroes earn experience.
      const awardXp = (hero: Hero | null, lost: boolean, amount: number, owner: Player) => {
        if (!hero || lost) return;
        const liveHero = findHeroByOwner(state, owner.id);
        if (!liveHero) return;
        grantHeroXp(liveHero, amount).forEach(message => {
          pushEvent(state, {
            type: 'hero',
            playerId: owner.id,
            playerName: owner.name,
            playerNumber: owner.number,
            message,
            details: { hero: liveHero.name },
          });
        });
      };

      awardXp(attackerHero, outcome.attackerReport.heroLost, outcome.attackerXp, attacker);
      awardXp(defenderHero, outcome.defenderReport.heroLost, outcome.defenderXp, defender);

      const winnerLabel = outcome.winner === 'attacker'
        ? `${attacker.name} won the engagement`
        : outcome.winner === 'defender'
          ? `${defender.name} repelled the attack`
          : 'The clash ended in a stand-off';

      pushEvent(state, {
        type: 'combat',
        message: winnerLabel,
        details: {},
      });

      const result: CombatResult = {
        id: `combat_${Date.now()}_${Math.random()}`,
        attacker: {
          playerId: attackerId,
          playerName: attacker.name,
          playerNumber: attacker.number,
          heroName: attackerHero?.name ?? null,
          heroClassId: attackerHero?.classId ?? null,
          power: outcome.attackerPower,
          roll: outcome.attackerRoll,
          armyLosses: outcome.attackerReport.armyLosses,
          heroLost: outcome.attackerReport.heroLost,
          hpDamage: outcome.attackerReport.playerHpDamage,
          xpGained: outcome.attackerReport.heroLost ? 0 : outcome.attackerXp,
        },
        defender: {
          playerId: defenderId,
          playerName: defender.name,
          playerNumber: defender.number,
          heroName: defenderHero?.name ?? null,
          heroClassId: defenderHero?.classId ?? null,
          power: outcome.defenderPower,
          roll: outcome.defenderRoll,
          armyLosses: outcome.defenderReport.armyLosses,
          heroLost: outcome.defenderReport.heroLost,
          hpDamage: outcome.defenderReport.playerHpDamage,
          xpGained: outcome.defenderReport.heroLost ? 0 : outcome.defenderXp,
        },
        winnerId: outcome.winner === 'attacker'
          ? attackerId
          : outcome.winner === 'defender'
            ? defenderId
            : null,
        location: defender.position,
        terrain: defenderTerrain?.name ?? 'Unknown',
        roundNumber: state.roundNumber,
        timestamp: Date.now(),
      };

      state.lastCombatResult = result;
    },

    dismissCombatResult: (state) => {
      state.lastCombatResult = null;
    },

    syncGameState: (_state, action: PayloadAction<GameState>) => {
      return action.payload;
    },

    returnToLobby: () => {
      return {
        ...initialState,
        teams: generateTeams(),
        globalItemQuantities: buildInitialItemQuantities(),
        heroes: [],
        selectedHeroId: null,
        lastCombatResult: null,
      };
    },
  },
});

export const {
  joinGame,
  leaveGame,
  togglePlayerReady,
  startGame,
  endGame,
  movePlayer,
  updateGameTimer,
  updatePhaseTimer,
  dismissPhaseOverlay,
  forceNextPhase,
  nextRound,
  setCurrentPlayer,
  harvestFromTile,
  craftItem,
  activateItemEffect,
  updateTeamScore,
  proposeTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  selectHero,
  recruitHero,
  restHero,
  learnSkill,
  castSpell,
  recruitUnit,
  initiateCombat,
  dismissCombatResult,
  syncGameState,
  returnToLobby,
} = gameSlice.actions;

export default gameSlice.reducer;

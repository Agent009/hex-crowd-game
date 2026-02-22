import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { coordsToKey, areAdjacent, CubeCoords } from '../utils/hexGrid';
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
  GamePhase,
  PlayerStats,
  ActivityEvent,
  PlayerState,
  PhaseState,
} from './types';

export type { GamePhase, PlayerStats, ActivityEvent };

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

const initialState: GameState = {
  players: [],
  teams: generateTeams(),
  currentPlayer: null,
  playerStats: {},
  gameMode: 'lobby',
  gameTimer: 0,
  roundNumber: 1,
  activityEvents: [],

  currentPhase: 'round_start',
  phaseStartTime: 0,
  phaseTimer: 0,
  showPhaseOverlay: false,
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
              if (damage < 0) {
                const playerStats = state.playerStats[player.id];
                if (playerStats) {
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
    joinGame: (state, action: PayloadAction<{ playerName: string }>) => {
      const { playerName } = action.payload;

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
        id: `player_${Date.now()}_${Math.random()}`,
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
                    message: `${player.name || 'Unknown'} ${statusMessage}`,
                    details: {}
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
        const itemTemplate = itemDatabase.find(item => item.id === itemId);
        if (itemTemplate) {
          const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
          playerStats.items.push({ ...itemTemplate, availableUses: uses });
        }
      } else if (resourceId) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) + 1;
      }

      if (isItem && itemId) {
        const itemTemplate = itemDatabase.find(item => item.id === itemId);
        if (itemTemplate) {
          state.activityEvents.unshift({
            id: `${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
            type: 'harvesting',
            playerId,
            playerName: player.name,
            playerNumber: player.number,
            message: `${player.name} harvested ${itemTemplate.name}`,
            details: { item: itemTemplate.name }
          });
        }
      } else if (resourceId) {
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

      for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
        if ((playerStats.resources[resourceId] || 0) < required) return;
      }

      for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) - required;
      }

      const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
      playerStats.items.push({ ...itemTemplate, availableUses: uses });

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
} = gameSlice.actions;

export default gameSlice.reducer;

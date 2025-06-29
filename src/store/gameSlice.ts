import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CubeCoords, HexTile, coordsToKey, generateHexSpiral } from '../utils/hexGrid';
import { itemDatabase } from '../data/harvestData';
import {
  gameSize,
  maxPlayers,
  requiredTeams,
  requiredPlayersPerTeam,
  isTestMode,
  predefinedTerrain,
  playerStartingPositions,
  teamColors,
  Player,
  Team,
  TerrainType
} from '../data/gameData';

export interface GameState {
  // World state
  tiles: { [key: string]: HexTile };
  worldSize: number;
  selectedTile: CubeCoords | null;

  // Party game state
  gameMode: 'lobby' | 'playing' | 'ended';
  players: Player[];
  teams: Team[];
  currentPlayer: Player | null;
  gameTimer: number;
  roundNumber: number;

  // Player stats for party game
  playerStats: { [playerId: string]: PlayerStats };

  // Tile states
  activeTiles: string[]; // Tiles that can be harvested from

  // UI state
  showGrid: boolean;
  cameraPosition: { x: number; y: number };
  zoomLevel: number;
  showPlayerNumbers: boolean;
}

export interface PlayerStats {
  hp: number;
  actionPoints: number;
  coins: number;
  resources: { [resourceId: string]: number };
  items: ItemData[];
  crests: number;
}

import { ItemData } from '../data/harvestData';

const generatePartyGameWorld = (size: number): { [key: string]: HexTile } => {
  const tiles: { [key: string]: HexTile } = {};
  const center: CubeCoords = { q: 0, r: 0, s: 0 };

  // Generate hex grid using proper spiral generation
  const coords = generateHexSpiral(center, size);

  coords.forEach(coord => {
    const key = coordsToKey(coord);

    // Use predefined terrain if available, otherwise default to plains
    const terrain: TerrainType = predefinedTerrain[key] || 'plains';

    tiles[key] = {
      coords: coord,
      terrain,
      explored: true, // All tiles visible in party game
      visible: true,
      fogLevel: 2, // No fog of war in party game
      isActive: true, // All tiles start as active
    };
  });

  return tiles;
};

// Generate teams with colors
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

const initialState: GameState = {
  tiles: generatePartyGameWorld(gameSize),
  worldSize: gameSize,
  selectedTile: null,

  gameMode: 'lobby',
  players: [],
  teams: generateTeams(),
  currentPlayer: null,
  gameTimer: 0,
  roundNumber: 1,

  playerStats: {},
  activeTiles: Object.keys(generatePartyGameWorld(gameSize)),

  showGrid: true,
  cameraPosition: { x: 0, y: 0 },
  zoomLevel: 1,
  showPlayerNumbers: true
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // Player management
    joinGame: (state, action: PayloadAction<{ playerName: string }>) => {
      const { playerName } = action.payload;

      if (state.players.length >= maxPlayers) {
        return; // Game is full
      }

      // Find available player number (1-30)
      const usedNumbers = new Set(state.players.map(p => p.number));
      let playerNumber = 1;
      while (usedNumbers.has(playerNumber) && playerNumber <= maxPlayers) {
        playerNumber++;
      }

      if (playerNumber > maxPlayers) {
        return; // No available slots
      }

      // Assign to team with fewest players
      const teamPlayerCounts = state.teams.map(team => ({
        team,
        count: team.playerIds.length
      }));
      teamPlayerCounts.sort((a, b) => a.count - b.count);
      const assignedTeam = teamPlayerCounts[0].team;

      const newPlayer: Player = {
        id: `player_${Date.now()}_${Math.random()}`,
        name: playerName,
        number: playerNumber,
        teamId: assignedTeam.id,
        color: assignedTeam.color,
        position: playerStartingPositions[playerNumber - 1],
        isReady: isTestMode, // Auto-ready in test mode
        isConnected: true
      };

      state.players.push(newPlayer);
      assignedTeam.playerIds.push(newPlayer.id);

      // Place player on their starting tile
      const tileKey = coordsToKey(newPlayer.position);
      if (state.tiles[tileKey]) {
        if (!state.tiles[tileKey].players) {
          state.tiles[tileKey].players = [];
        }
        state.tiles[tileKey].players!.push(newPlayer);
      }

      // Initialize player stats
      state.playerStats[newPlayer.id] = {
        hp: 10,
        actionPoints: 0, // Will get +2 AP at start of each round
        coins: 0,
        resources: {},
        items: [],
        crests: 0
      };

      // Set as current player if first to join
      if (!state.currentPlayer) {
        state.currentPlayer = newPlayer;
      }
    },

    leaveGame: (state, action: PayloadAction<{ playerId: string }>) => {
      const { playerId } = action.payload;
      const playerIndex = state.players.findIndex(p => p.id === playerId);

      if (playerIndex === -1) return;

      const player = state.players[playerIndex];

      // Remove from team
      const team = state.teams.find(t => t.id === player.teamId);
      if (team) {
        team.playerIds = team.playerIds.filter(id => id !== playerId);
      }

      // Remove from tile
      const tileKey = coordsToKey(player.position);
      if (state.tiles[tileKey]?.players) {
        state.tiles[tileKey].players = state.tiles[tileKey].players!.filter(p => p.id !== playerId);
      }

      // Remove player
      state.players.splice(playerIndex, 1);

      // Remove player stats
      delete state.playerStats[playerId];

      // Update current player if needed
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
      // Check if we have the required number of teams and players per team
      const teamsWithPlayers = state.teams.filter(t => t.playerIds.length >= requiredPlayersPerTeam);
      const hasRequiredTeams = teamsWithPlayers.length >= requiredTeams;
      const allPlayersReady = state.players.every(p => p.isReady);

      // In test mode, allow starting with fewer requirements
      const canStart = isTestMode
        ? (state.players.length >= 2 && allPlayersReady)
        : (hasRequiredTeams && allPlayersReady);

      if (canStart) {
        state.gameMode = 'playing';
        state.gameTimer = 0;
        state.roundNumber = 1;

        // Give all players +2 AP to start
        state.players.forEach(player => {
          if (state.playerStats[player.id]) {
            state.playerStats[player.id].actionPoints += 2;
          }
        });
      }
    },

    endGame: (state) => {
      state.gameMode = 'ended';
    },

    // Game mechanics
    selectTile: (state, action: PayloadAction<CubeCoords>) => {
      state.selectedTile = action.payload;
    },

    movePlayer: (state, action: PayloadAction<{ playerId: string; target: CubeCoords }>) => {
      const { playerId, target } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];

      if (!player || !playerStats) return;

      // Calculate movement cost based on target terrain
      const targetTileKey = coordsToKey(target);
      const targetTile = state.tiles[targetTileKey];
      if (!targetTile) return;

      const movementCost = targetTile.terrain === 'lake' ? 2 :
                          targetTile.terrain === 'river' ? 2 :
                          targetTile.terrain === 'mountain' ? 3 :
                          targetTile.terrain === 'desert' ? 2 :
                          targetTile.terrain === 'forest' ? 2 :
                          1; // plains

      // Check if player has enough AP
      if (playerStats.actionPoints < movementCost) {
        return; // Not enough AP to move
      }

      // Deduct AP for movement
      playerStats.actionPoints -= movementCost;

      // Remove player from current tile
      const currentTileKey = coordsToKey(player.position);
      if (state.tiles[currentTileKey]?.players) {
        state.tiles[currentTileKey].players = state.tiles[currentTileKey].players!.filter(p => p.id !== playerId);
      }

      // Update player position
      player.position = target;

      // Add player to new tile
      const newTileKey = coordsToKey(target);
      if (state.tiles[newTileKey]) {
        if (!state.tiles[newTileKey].players) {
          state.tiles[newTileKey].players = [];
        }
        state.tiles[newTileKey].players!.push(player);
      }
    },

    updateGameTimer: (state, action: PayloadAction<number>) => {
      state.gameTimer = action.payload;
    },

    nextRound: (state) => {
      state.roundNumber += 1;

      // Give all players +2 AP at start of each round
      state.players.forEach(player => {
        if (state.playerStats[player.id]) {
          state.playerStats[player.id].actionPoints += 2;
        }
      });
    },

    // Harvesting mechanics
    harvestFromTile: (state, action: PayloadAction<{
      playerId: string;
      tileCoords: CubeCoords;
      resourceId?: string;
      itemId?: string;
      isItem: boolean;
    }>) => {
      const { playerId, tileCoords, resourceId, itemId, isItem } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      const playerStats = state.playerStats[playerId];
      const tileKey = coordsToKey(tileCoords);
      const tile = state.tiles[tileKey];

      if (!player || !playerStats || !tile) return;

      // Check if player is on the tile
      const isPlayerOnTile = tile.players?.some(p => p.id === playerId);
      if (!isPlayerOnTile) return;

      // Check if tile is active
      if (!state.activeTiles.includes(tileKey)) return;

      // Check AP requirements
      const apCost = isItem ? 3 : 1;
      if (playerStats.actionPoints < apCost) return;

      // Deduct AP
      playerStats.actionPoints -= apCost;

      // Add resource/item to player
      if (isItem && itemId) {
        // Find the item template from the database
        const itemTemplate = itemDatabase.find(item => item.id === itemId);
        if (itemTemplate) {
          // Generate random uses within the item's range
          const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
          const harvestedItem = {
            ...itemTemplate,
            minUses: uses,
            maxUses: uses
          };
          playerStats.items.push(harvestedItem);
        }
      } else if (resourceId) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) + 1;
      }

      // Deactivate tile (except lakes which can be harvested multiple times)
      if (tile.terrain !== 'lake') {
        const tileIndex = state.activeTiles.indexOf(tileKey);
        if (tileIndex > -1) {
          state.activeTiles.splice(tileIndex, 1);
        }
        tile.isActive = false;
      }
    },

    // Test mode controls
    setCurrentPlayer: (state, action: PayloadAction<{ playerId: string }>) => {
      const player = state.players.find(p => p.id === action.payload.playerId);
      if (player) {
        state.currentPlayer = player;
      }
    },

    updateTeamScore: (state, action: PayloadAction<{ teamId: string; points: number }>) => {
      const { teamId, points } = action.payload;
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        team.score += points;
      }
    },

    // Crafting mechanics
    craftItem: (state, action: PayloadAction<{
      playerId: string;
      itemId: string;
    }>) => {
      const { playerId, itemId } = action.payload;
      const playerStats = state.playerStats[playerId];

      if (!playerStats) return;

      // Find the item template
      const itemTemplate = itemDatabase.find(item => item.id === itemId);
      if (!itemTemplate) return;

      // Check if player has required resources
      for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
        if ((playerStats.resources[resourceId] || 0) < required) {
          return; // Not enough resources
        }
      }

      // Consume resources
      for (const [resourceId, required] of Object.entries(itemTemplate.craftingRequirements)) {
        playerStats.resources[resourceId] = (playerStats.resources[resourceId] || 0) - required;
      }

      // Generate item with random uses
      const uses = Math.floor(Math.random() * (itemTemplate.maxUses - itemTemplate.minUses + 1)) + itemTemplate.minUses;
      const craftedItem = {
        ...itemTemplate,
        minUses: uses,
        maxUses: uses
      };

      // Add crafted item to player's inventory
      playerStats.items.push(craftedItem);
    },
    // UI controls
    setCameraPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.cameraPosition = action.payload;
    },

    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.zoomLevel = Math.max(0.5, Math.min(2, action.payload));
    },

    toggleGrid: (state) => {
      state.showGrid = !state.showGrid;
    },

    togglePlayerNumbers: (state) => {
      state.showPlayerNumbers = !state.showPlayerNumbers;
    }
  }
});

export const {
  joinGame,
  leaveGame,
  togglePlayerReady,
  startGame,
  endGame,
  selectTile,
  movePlayer,
  updateGameTimer,
  nextRound,
  setCurrentPlayer,
  harvestFromTile,
  craftItem,
  updateTeamScore,
  setCameraPosition,
  setZoomLevel,
  toggleGrid,
  togglePlayerNumbers
} = gameSlice.actions;

export default gameSlice.reducer;
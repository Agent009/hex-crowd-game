import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CubeCoords, HexTile, coordsToKey, generateHexSpiral } from '../utils/hexGrid';
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

  // UI state
  showGrid: boolean;
  cameraPosition: { x: number; y: number };
  zoomLevel: number;
  showPlayerNumbers: boolean;
}

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
      
      if (!player) return;

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
    },

    updateTeamScore: (state, action: PayloadAction<{ teamId: string; points: number }>) => {
      const { teamId, points } = action.payload;
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        team.score += points;
      }
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
  updateTeamScore,
  setCameraPosition,
  setZoomLevel,
  toggleGrid,
  togglePlayerNumbers
} = gameSlice.actions;

export default gameSlice.reducer;
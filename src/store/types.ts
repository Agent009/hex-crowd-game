import { CubeCoords, HexTile } from '../utils/hexGrid';
import { ItemData } from '../data/harvestData';
import { Player, Team } from '../data/gameData';

export type GamePhase =
  | 'round_start'
  | 'ap_renewal'
  | 'interaction'
  | 'bartering'
  | 'terrain_effects'
  | 'disaster_check'
  | 'elimination';

export interface PlayerStats {
  hp: number;
  actionPoints: number;
  coins: number;
  resources: { [resourceId: string]: number };
  items: ItemData[];
  crests: number;
  statusEffects: string[];
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'movement' | 'item_usage' | 'crafting' | 'harvesting' | 'terrain_effect' | 'damage' | 'healing' | 'disaster' | 'elimination' | 'round_start' | 'phase_change' | 'phase_effect' | 'trade';
  subtype?: 'ap_renewal' | 'terrain_effect' | 'disaster';
  playerId?: string;
  playerName?: string;
  playerNumber?: number;
  message: string;
  details?: {
    coords?: { q: number; r: number; s: number };
    terrain?: string;
    item?: string;
    resource?: string;
    damage?: number;
    healing?: number;
    disaster?: string;
    affectedPlayers?: string[];
  };
}

export interface WorldState {
  tiles: { [key: string]: HexTile };
  worldSize: number;
  selectedTile: CubeCoords | null;
  activeTiles: string[];
}

export interface PlayerState {
  players: Player[];
  teams: Team[];
  currentPlayer: Player | null;
  playerStats: { [playerId: string]: PlayerStats };
  gameMode: 'lobby' | 'playing' | 'ended';
  gameTimer: number;
  roundNumber: number;
  activityEvents: ActivityEvent[];
  tradeProposals: TradeProposal[];
  globalItemQuantities: { [itemId: string]: number };
}

export interface PhaseState {
  currentPhase: GamePhase;
  phaseStartTime: number;
  phaseTimer: number;
  showPhaseOverlay: boolean;
}

export interface TradeProposal {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredResources: { [resourceId: string]: number };
  requestedResources: { [resourceId: string]: number };
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: number;
}

export interface UIState {
  showGrid: boolean;
  cameraPosition: { x: number; y: number };
  zoomLevel: number;
  showPlayerNumbers: boolean;
  showTileInfo: boolean;
}

import { useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { selectTile } from '../store/worldSlice';
import { setCurrentPlayer, forceNextPhase } from '../store/gameSlice';
import { coordsToKey, cubeAdd, CubeCoords } from '../utils/hexGrid';
import { isTestMode } from '../data/gameData';
import { useMultiplayer } from './useMultiplayer';
import { GameScene } from '../game/GameEngine';
import { getPhaserGame } from '../game/phaserRef';

/**
 * WASD hex cursor movement.
 *
 * A/D step along the q axis, W/S along the r axis. Because q and r are the two
 * independent axes of the cube/axial hex system, these four keys are enough to
 * reach every tile on the board (unlike trying to map four keys onto the six
 * screen-space neighbour directions). Visually: A=left, D=right, W=up-left,
 * S=down-right.
 */
const WASD_DIRECTIONS: Record<string, CubeCoords> = {
  d: { q: 1, r: 0, s: -1 },
  a: { q: -1, r: 0, s: 1 },
  s: { q: 0, r: 1, s: -1 },
  w: { q: 0, r: -1, s: 1 },
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

interface UseGameKeyboardOptions {
  /** Toggle the local phase timer pause state (bound to Space). */
  onTogglePause: () => void;
}

/**
 * Global in-game keyboard navigation / accessibility shortcuts:
 *  - 1-9 / 0  : switch the controlled player (local test mode only; 0 = player 10)
 *  - W/A/S/D  : move the hex selection cursor across the board
 *  - Space    : pause / resume the phase timer
 *  - = / +    : skip to the next phase
 *
 * Arrow keys (map panning) are handled inside the Phaser scene, and the radial
 * action menu (Tab / Enter / Backspace) is handled in HexActionMenu.
 */
export const useGameKeyboard = ({ onTogglePause }: UseGameKeyboardOptions): void => {
  const dispatch = useDispatch();
  const { players, currentPlayer, gameMode, currentPhase, showPhaseOverlay } = useSelector(
    (state: RootState) => state.game
  );
  // Only the round_start overlay is a blocking modal; other phases render a
  // non-blocking dock, so the cursor must stay usable there.
  const blockingOverlay = showPhaseOverlay && currentPhase === 'round_start';
  const { tiles, selectedTile } = useSelector((state: RootState) => state.world);
  const { isMultiplayer, sendForceNextPhase } = useMultiplayer();

  const ensureTileVisible = useCallback((coords: CubeCoords) => {
    const scene = getPhaserGame()?.scene?.getScene('GameScene') as GameScene | undefined;
    scene?.ensureTileVisible?.(coords);
  }, []);

  useEffect(() => {
    if (gameMode !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never hijack typing or app-level chords (Ctrl/Cmd/Alt + key).
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      // --- Switch controlled player (local test mode only) ---
      if (isTestMode && !isMultiplayer && /^[0-9]$/.test(key)) {
        const targetNumber = key === '0' ? 10 : parseInt(key, 10);
        const player = players.find((p) => p.number === targetNumber);
        if (player) {
          e.preventDefault();
          dispatch(setCurrentPlayer({ playerId: player.id }));
        }
        return;
      }

      // --- Skip to next phase ---
      if (key === '=' || key === '+') {
        e.preventDefault();
        if (isMultiplayer) sendForceNextPhase();
        else dispatch(forceNextPhase());
        return;
      }

      // --- Pause / resume the phase timer ---
      if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onTogglePause();
        return;
      }

      // --- WASD hex cursor navigation ---
      const direction = WASD_DIRECTIONS[key.toLowerCase()];
      if (direction) {
        if (blockingOverlay) return;
        e.preventDefault();

        // First press with nothing selected drops the cursor on the player's tile.
        if (!selectedTile) {
          if (currentPlayer?.position) {
            dispatch(selectTile(currentPlayer.position));
            ensureTileVisible(currentPlayer.position);
          }
          return;
        }

        const next = cubeAdd(selectedTile, direction);
        if (tiles[coordsToKey(next)]) {
          dispatch(selectTile(next));
          ensureTileVisible(next);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    dispatch,
    players,
    currentPlayer,
    tiles,
    selectedTile,
    gameMode,
    blockingOverlay,
    isMultiplayer,
    sendForceNextPhase,
    onTogglePause,
    ensureTileVisible,
  ]);
};

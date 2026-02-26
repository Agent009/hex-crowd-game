# Improvements Status

## Overview

Tracks the implementation progress of all deferred features cataloged in `Improvements.md`. Each item is updated as work begins and completes. Items are worked through in dependency order — foundational systems before features that depend on them.

---

## Phase C: Dead Code Removal

### C1 — GameHUD.tsx Dead Code — COMPLETE
- **Status:** Done
- **Notes:** `GameHUD.tsx` deleted. Was never imported in `Game.tsx` — `PartyGameHUD.tsx` is the sole active HUD.

---

## Phase M: Game Mechanics

### M1 — Bartering / Trading Phase — COMPLETE
- **Status:** Done
- **Notes:** Full trade system implemented end-to-end.
  - `TradeProposal` type added to `types.ts`; `tradeProposals: []` added to Redux state.
  - Four new reducers in `gameSlice.ts`: `proposeTrade` (validates sender has offered resources, enforces bartering-phase-only), `acceptTrade` (atomic resource swap, validates both parties still have required resources), `rejectTrade`, `cancelTrade`.
  - `BarteringPanel` component (`src/components/UI/BarteringPanel.tsx`): resource counter UI for building an offer/request, player selector, live proposal cards with Accept/Reject/Cancel actions, inbound proposal alert badge.
  - Trade tab added to `HarvestGrid` as a 4th tab (teal icon). The Trade button in `PartyGameHUD` pulses amber during bartering phase to draw attention.
  - Trade history persists within the session (proposals visible to both sender and receiver with status labels).

### M2 — Combat System — OPEN
- **Status:** Not started
- **Blocker:** H1, H6, H7 (hero stats needed for combat calculation)
- **Notes:** No combat logic exists anywhere. Requires damage model, turn order, and outcome resolution (elimination or retreat).

### M3 — Victory Conditions — OPEN
- **Status:** Not started
- **Blocker:** M2 (combat is the primary elimination path)
- **Notes:** `removeEliminatedPlayers` exists but no win-state detection or end-game screen fires.

### M4 — Plains HP Gain Per Round — OPEN
- **Status:** Not started
- **Blocker:** None
- **Notes:** Small isolated fix. `hpGainPerRound` is defined in terrain data but never read in `gameSlice.ts` terrain processing.

---

## Phase I: Item System

### I1 — Terraform Item Effect — OPEN
- **Status:** Not started
- **Blocker:** None
- **Notes:** `consumeItemUse()` needs to branch on item ID/effect type and call a new `activateTiles` reducer.

### I2 — Leech Item Effect — OPEN
- **Status:** Not started
- **Blocker:** None
- **Notes:** Same pattern as I1. Needs a `deactivateTiles` reducer path.

### I3 — Armageddon Item Effect — OPEN
- **Status:** Not started
- **Blocker:** None
- **Notes:** Needs a damage-all-players reducer path in `consumeItemUse()`. Activity log entry per affected player.

### I4 — Rejuvenate Item Effect — OPEN
- **Status:** Not started
- **Blocker:** None
- **Notes:** Needs a heal-self reducer path in `consumeItemUse()`. HP capped at player max HP.

### I5 — Boat Storm Destruction — COMPLETE
- **Status:** Done
- **Notes:** `applyDisasterCheck` in `gameSlice.ts` now special-cases the `storm` disaster on `lake`/`river` terrain. When a storm hits, each affected player's boat loses one use. If uses reach 0, the boat is removed and the player's HP is set to 0 (eliminated via the existing elimination phase). Players on water with no boat are immediately set to 0 HP. Both outcomes produce distinct activity log entries.

### I6 — Climbing Gear Terrain Lock — COMPLETE
- **Status:** Done
- **Notes:** `movePlayer` reducer in `gameSlice.ts` now checks the player's **current** tile before allowing movement. If standing on a mountain tile (any tile whose `requiredItem` is `climbing_gear`), movement is blocked unless the player holds at least one climbing gear with remaining uses. No gear → cannot leave the mountain.

### I7 — Global Item Quantity Limits — OPEN
- **Status:** Not started
- **Blocker:** P1 or P2 (requires shared state across clients for true enforcement)
- **Notes:** Can be partially implemented in local state for single-session enforcement. Full enforcement requires server-side tracking.

---

## Phase H: Hero System

### H1 — Hero State Missing from Redux — OPEN
- **Status:** Not started
- **Blocker:** None (foundational)
- **Notes:** Must be completed before any other H-category item. Add `heroes` array and `selectedHero` to game state. Export `selectHero` reducer.

### H2 — "View Army" Button — OPEN
- **Status:** Not started
- **Blocker:** H1, H6, H10
- **Notes:** Requires army data to exist before the panel is useful.

### H3 — "Skills" Button — OPEN
- **Status:** Not started
- **Blocker:** H1, H8
- **Notes:** Requires hero leveling and skill data structures.

### H4 — "Cast Spell" Button — OPEN
- **Status:** Not started
- **Blocker:** H1, H9
- **Notes:** Requires spell data and casting logic.

### H5 — "Rest" Button — OPEN
- **Status:** Not started
- **Blocker:** H1
- **Notes:** Simpler than H2–H4. Consumes remaining AP, restores some HP. Can be done immediately after H1.

### H6 — Hero Recruitment System — OPEN
- **Status:** Not started
- **Blocker:** H1
- **Notes:** Requires a town or start-location mechanic. Players recruit heroes from fixed locations.

### H7 — Hero Movement Mechanics — OPEN
- **Status:** Not started
- **Blocker:** H1, H6
- **Notes:** Heroes need a position in the hex grid and AP consumption on movement.

### H8 — Hero Leveling & XP — OPEN
- **Status:** Not started
- **Blocker:** H1, H6, M2
- **Notes:** XP primarily awarded from combat. Stats increase at level thresholds.

### H9 — Spell Casting System — OPEN
- **Status:** Not started
- **Blocker:** H1, H6, H8
- **Notes:** Requires `spellsData.ts`, mana tracking on heroes, and effect dispatch logic.

### H10 — Army Unit Management — OPEN
- **Status:** Not started
- **Blocker:** H1, H6
- **Notes:** Requires unit data structures and recruitment UI.

---

## Phase B: Building System

### B1 — Building System Mechanics — OPEN
- **Status:** Not started
- **Blocker:** None
- **Notes:** Pending design decision. Either implement tile-based construction or remove `buildingsData.ts` and `BuildingGuide.tsx` as legacy files.

---

## Phase P: Multiplayer & Infrastructure

### P1 — Real-Time Multiplayer — COMPLETE
- **Status:** Done
- **Notes:** Full real-time multiplayer using Supabase Realtime broadcast channels. Host-authoritative architecture.
  - **Database**: `game_sessions` table with RLS, stores session code, host ID, player count, game mode.
  - **Session flow**: Main menu with Create Online / Join Online / Local Game options. Host creates session, gets 6-char code. Others join via code.
  - **RealtimeService** (`src/services/RealtimeService.ts`): Singleton service managing Supabase Realtime channel. Host processes all game actions and broadcasts state to clients every second. Clients send actions via broadcast, host validates and applies them.
  - **State sync**: `syncGameState` and `syncWorldState` reducers replace full client state with host-authoritative state on every tick.
  - **Host migration**: If host disconnects, the next connected player (sorted by ID) automatically becomes host and starts the game loop.
  - **Session slice** (`src/store/sessionSlice.ts`): Redux state for sessionId, sessionCode, hostPlayerId, localPlayerId, connection status, connected player list.
  - **useMultiplayer hook** (`src/hooks/useMultiplayer.ts`): Convenience hook exposing all multiplayer actions (sendMove, sendHarvest, sendCraft, etc.).
  - **GameLobby rewrite**: Menu screen with 3 options, create/join forms with loading states, session code display with copy button, connection status indicator.
  - **PartyGameHUD updates**: Host indicator badge, multiplayer-aware phase timer (only host runs the loop), auto-set currentPlayer to local player.
  - **Local mode preserved**: Local Game mode works exactly as before with no network dependency.

### P2 — Game Session Persistence — COMPLETE
- **Status:** Done
- **Notes:** Full game state persistence implemented.
  - **Database**: Added `game_state`, `world_state`, `last_saved_at`, and `round_number` columns to `game_sessions` table. Created `game_turn_history` table for action audit trail.
  - **Host auto-save**: Host saves game state to database every 5 seconds (debounced to avoid unnecessary writes).
  - **Reconnection flow**: New "Reconnect to Game" option in main menu. Players can enter a session code, check session status (lobby/playing/ended), and rejoin.
  - **State restoration**: On reconnect, full game state and world state are loaded from database, then synced via Realtime channel.
  - **Join in-progress**: Players joining an in-progress game receive the persisted state immediately.
  - **useMultiplayer hook**: Added `reconnectSession` and `getActiveSession` methods.

### P3 — Player Authentication — OPEN
- **Status:** Not started
- **Blocker:** P1
- **Notes:** Supabase Auth email/password. Player identity persists across sessions. Stats tied to account.

---

## Progress Summary

| Phase | Total Items | OPEN | IN PROGRESS | COMPLETE |
|-------|------------|------|-------------|---------|
| C — Dead Code | 1 | 0 | 0 | 1 |
| M — Game Mechanics | 4 | 3 | 0 | 1 |
| I — Item System | 7 | 5 | 0 | 2 |
| H — Hero System | 10 | 10 | 0 | 0 |
| B — Building System | 1 | 1 | 0 | 0 |
| P — Infrastructure | 3 | 1 | 0 | 2 |
| **TOTAL** | **26** | **20** | **0** | **6** |

---

## Recommended Implementation Order

Work through items in this sequence to respect dependencies and deliver value incrementally:

1. **C1** — Remove GameHUD dead code (cleanup, unblocks clarity)
2. **M4** — Plains HP gain (isolated, 15-minute fix)
3. **I1–I4** — Special item effects (terraform, leech, armageddon, rejuvenate)
4. **I5–I6** — Boat storm / climbing gear survival mechanics
5. **I7** — Global item quantity limits (local enforcement first)
6. **M1** — Bartering phase (standalone mechanic)
7. **H1** — Hero Redux state (unlocks all H-category work)
8. **H5** — Rest button (simplest hero action, validates H1)
9. **H6** — Hero recruitment
10. **H2, H3** — View Army, Skills (once H6 and H10/H8 are ready)
11. **H7** — Hero movement
12. **H8** — Hero leveling/XP
13. **H4, H9** — Cast Spell + spell system
14. **H10** — Army units
15. **M2** — Combat system
16. **M3** — Victory conditions
17. **B1** — Building system decision (implement or remove)
18. **P1** — Real-time multiplayer
19. **P2** — Session persistence
20. **P3** — Player authentication

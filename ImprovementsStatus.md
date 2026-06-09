# Improvements Status

**Last updated:** 2026-06-10 — hero/combat play surface, multiplayer action routing/auditing, host action/state-sync validation, persisted-state restore/status validation, ordered/deduplicated state-sync delivery, throttled state-sync payload budget diagnostics, disconnect grace-window handling, optional session authority gateway, Supabase runtime guard, realtime diagnostics export and sink, Supabase data-integrity hardening, material-rich hex/hero board visuals, canvas error recovery, focused unit/realtime/session/E2E tests, optional live Supabase E2E and long-soak harnesses, CI quality gates, production readiness runbook, 30-player load and sustained browser-runtime profiling, reconnect identity hardening, production chunk splitting, Vite 8 migration, and clean dependency audit.

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

### M2 — Combat System — COMPLETE
- **Status:** Done
- **Notes:** Hero-led combat is now playable.
  - Pure combat engine added in `src/game/combat.ts` for host-authoritative reuse.
  - `initiateCombat` reducer validates phase, adjacency, teams, and AP cost, then applies army losses, hero damage/loss, player HP damage, XP, and combat report state.
  - `HeroCommandPanel` exposes adjacent enemy attacks, and `CombatResultModal` reports powers, rolls, winner, XP, and losses.
  - Multiplayer action routing now broadcasts combat requests to the host before state sync.

### M3 — Victory Conditions — COMPLETE
- **Status:** Done
- Victory conditions are now fully wired:
- After each elimination phase, the game checks if a winner has emerged — either the last surviving player (solo) or the last team with any surviving players (team victory)
- When a winner is detected, gameMode transitions to 'ended' and a VictoryResult is stored with the winner's name, team, round number, and the list of surviving players
- A VictoryScreen overlay appears with a smooth fade-in animation showing: the winner's name, victory type (solo/team), round number, list of survivors, the elimination log, and final team scores if any
- Two buttons are provided — "Return to Lobby" and "Play Again" — both reset the full game state back to the lobby
- The activity log records the victory event for posterity

### M4 — Plains HP Gain Per Round — COMPLETE
- **Status:** Done
- During the terrain effects phase, players standing on plains tiles now roll against the 25% chance defined in the terrain data.
- On success, they gain 1 HP (capped at 10), and the event is logged to the activity feed with a status effect indicator.

---

## Phase I: Item System

### I1 — Terraform Item Effect — COMPLETE
- **Status:** Done
- Using Terraform selects 3 currently inactive tiles at random and activates them, making them harvestable.
- Implemented as a thunk that dispatches the new activateTile world action.

### I2 — Leech Item Effect — COMPLETE
- **Status:** Done
- Using Leech deactivates 2 random active tiles (excluding the tile the player is currently on). Also a thunk using the existing deactivateTile world action.

### I3 — Armageddon Item Effect — COMPLETE
- **Status:** Done
- Using Armageddon deals 2 HP damage to every other player in the game, with individual activity log entries per affected player.

### I4 — Rejuvenate Item Effect — COMPLETE
- **Status:** Done
- Using Rejuvenate heals the player for +3 HP, capped at max HP of 10.

### I5 — Boat Storm Destruction — COMPLETE
- **Status:** Done
- **Notes:** `applyDisasterCheck` in `gameSlice.ts` now special-cases the `storm` disaster on `lake`/`river` terrain. When a storm hits, each affected player's boat loses one use. If uses reach 0, the boat is removed and the player's HP is set to 0 (eliminated via the existing elimination phase). Players on water with no boat are immediately set to 0 HP. Both outcomes produce distinct activity log entries.

### I6 — Climbing Gear Terrain Lock — COMPLETE
- **Status:** Done
- **Notes:** `movePlayer` reducer in `gameSlice.ts` now checks the player's **current** tile before allowing movement. If standing on a mountain tile (any tile whose `requiredItem` is `climbing_gear`), movement is blocked unless the player holds at least one climbing gear with remaining uses. No gear → cannot leave the mountain.

### I7 — Global Item Quantity Limits — COMPLETE
- **Status:** Done
- Global item quantity tracking is now enforced across the game:
- Each item type (boat, climbing gear, rejuvenate, etc.) now has a shared global counter initialized from its quantity field in the data
- When any player harvests an item, the global counter for that item decrements — if it reaches 0, no more copies can be obtained by anyone
- Same enforcement applies to crafting — players cannot craft an item whose global supply is exhausted
- The Items tab in the Harvest Grid now shows a remaining/total badge per item (color-coded: red = exhausted, orange = low, grey = normal)
- The Crafting tab shows the same badges and an "Supply exhausted" warning when applicable
- The activity log entry when harvesting an item now includes how many remain globally (e.g. "Player 1 harvested Boat (4 remaining)")

---

## Phase H: Hero System

### H1 — Hero State Missing from Redux — COMPLETE
- **Status:** Done
- **Notes:** `heroes`, `selectedHeroId`, and `lastCombatResult` are now part of game state, with hero selection and cleanup on player leave/elimination.

### H2 — "View Army" Button — COMPLETE
- **Status:** Done
- **Notes:** Army management is available from `HeroCommandPanel`, including current stacks, capacity, resource/AP costs, and unit recruitment.

### H3 — "Skills" Button — COMPLETE
- **Status:** Done
- **Notes:** Skill definitions and rank effects are implemented. The skills tab spends hero skill points and recalculates derived stats.

### H4 — "Cast Spell" Button — COMPLETE
- **Status:** Done
- **Notes:** Spell data, mana costs, ranges, self/enemy targeting, and cast actions are implemented in reducers and the spells tab.

### H5 — "Rest" Button — COMPLETE
- **Status:** Done
- **Notes:** Rest consumes remaining player AP and restores hero HP/mana, with activity log feedback.

### H6 — Hero Recruitment System — COMPLETE
- **Status:** Done
- **Notes:** Players can recruit one hero during interaction phase from the Hero Command panel using AP and resources.

### H7 — Hero Movement Mechanics — COMPLETE
- **Status:** Done
- **Notes:** A player's active hero travels with the player. Logistics skill can reduce movement AP cost to a minimum of 1.

### H8 — Hero Leveling & XP — COMPLETE
- **Status:** Done
- **Notes:** Combat awards XP. Level-ups grant class stat growth, skill points, max HP/mana recalculation, full hero heal, and new spell unlocks on even levels.

### H9 — Spell Casting System — COMPLETE
- **Status:** Done
- **Notes:** `spellsData.ts` defines damage, drain, heal, buff, and energise spells. Reducers validate known spells, mana, team targeting, and range.

### H10 — Army Unit Management — COMPLETE
- **Status:** Done
- **Notes:** `unitsData.ts` defines unit stats/costs, army stack helpers, capacity enforcement, and recruitment UI.

---

## Phase B: Building System

### B1 — Building System Mechanics — COMPLETE
- **Status:** Done
- **Notes:** Legacy building data and guide files were removed. The current game direction is hero/army/combat on the hex board rather than city-building.

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
  - **2026-06-09 hardening:** Harvesting, crafting, item use, trading, movement, hero recruitment/rest/skills/spells/units, and combat now route through the multiplayer service in online mode instead of dispatching client-local state changes.
  - **2026-06-09 identity fix:** `joinGame` accepts a host/client-provided `playerId`, preventing client/host player ID drift during online joins.
  - **2026-06-09 auditability:** Host-routed actions now queue non-blocking `game_turn_history` writes with action type, derived player ID, round, phase, and payload.
  - **2026-06-09 diagnostics:** Realtime service keeps bounded diagnostics for missing channels, failed action broadcasts, invalid/rejected host actions, rejected malformed state-sync snapshots, disconnect grace-window expirations, failed state-sync broadcasts, persistence save failures, audit write failures, player-count update failures, and disconnect update failures. Diagnostics are also emitted as browser `hex:realtime-diagnostic` events and can be POSTed to `VITE_REALTIME_DIAGNOSTICS_ENDPOINT`.
  - **2026-06-09 host validation:** Host-authoritative action handling validates lobby joins/readiness/start, movement, harvesting, crafting, item use, trades, heroes, skills, spells, units, combat, phase control, and malformed/negative resource trade payloads before dispatching, syncing, or auditing.
  - **2026-06-09 state-sync validation:** Clients validate host snapshots before applying them, rejecting malformed mode/phase/player/team/stat/hero data, invalid world tiles, terrain keys, coordinate-key mismatches, active-tile references, and stale sequenced snapshots with an `invalid_state_sync` diagnostic.
  - **2026-06-09 ordered sync:** Host state-sync broadcasts now include a monotonic sequence, timestamp, and state hash. Clients reject out-of-order sequenced snapshots while still accepting legacy unsequenced payloads for compatibility.
  - **2026-06-09 sync dedupe:** Hosts skip exact-match state-sync broadcasts when the game/world hash matches the last successfully sent snapshot, reducing redundant realtime traffic after no-op state changes or repeated sync requests.
  - **2026-06-10 payload budget diagnostics:** Hosts measure sequenced state-sync payload size and emit throttled `state_sync_payload_large` warnings when snapshots exceed `VITE_STATE_SYNC_WARN_BYTES`, giving production an early signal before Realtime payload size becomes a live issue without flooding diagnostics.
  - **2026-06-09 disconnect handling:** Presence leaves are now debounced through a configurable grace window before game removal or host migration. Rejoins cancel pending disconnect finalization, reducing false eliminations during transient network drops.
  - **2026-06-09 authority gateway:** Production can configure `VITE_SESSION_AUTHORITY_ENDPOINT` to route host session creation, persistence saves, player-count updates, turn-audit writes, host claims, and session-end writes through the `session-authority` Supabase Edge Function with hashed host authority tokens instead of direct anonymous table updates.
  - **2026-06-09 contract coverage:** Host-authoritative action handling is extracted and covered by local tests for non-host ignore behaviour, host join/move/start/end side effects, invalid action rejection, negative trade-resource rejection, state-sync triggers, malformed state-sync rejection, player-count updates, and audit queuing.
  - **2026-06-09 mocked channel coverage:** Realtime state-sync, host-migration, presence join/leave, deferred disconnect callbacks, rejoin cancellation checks, and deterministic next-host selection are covered by local tests without a live Supabase project.

### P2 — Game Session Persistence — COMPLETE
- **Status:** Done
- **Notes:** Full game state persistence implemented.
  - **Database**: Added `game_state`, `world_state`, `last_saved_at`, and `round_number` columns to `game_sessions` table. Created `game_turn_history` table for action audit trail.
  - **Host auto-save**: Host saves game state to database every 5 seconds (debounced to avoid unnecessary writes).
  - **Reconnection flow**: New "Reconnect to Game" option in main menu. Players can enter a session code, check session status (lobby/playing/ended), and rejoin.
  - **State restoration**: On reconnect, full game state and world state are loaded from database, then synced via Realtime channel.
  - **Join in-progress**: Players joining an in-progress game receive the persisted state immediately.
  - **useMultiplayer hook**: Added `reconnectSession` and `getActiveSession` methods.
  - **2026-06-09 hardening:** Host save hashing now includes full game/world state, so action-only changes such as movement, inventory, hero, trade, or combat changes are not skipped between phase changes.
  - **2026-06-09 reconnect identity hardening:** Reconnect resolution now prefers exact player ID matches before falling back to display-name matches, avoiding accidental name-first identity swaps.
  - **2026-06-10 persisted-state validation:** In-progress joins and reconnects validate saved `game_state`/`world_state` snapshots before Redux restore, rejecting malformed persisted state with user-facing errors instead of applying corrupt state locally. Active-session summaries now include saved-state validity and the reconnect UI disables reconnect for corrupt in-progress state.
  - **2026-06-09 session contract coverage:** Join/reconnect/session-summary helpers cover full sessions, ended sessions, missing saved state, corrupt saved state, query failures, missing players, and persisted reconnect restoration without a live Supabase project.
  - **2026-06-09 live E2E harness:** A gated Playwright spec can exercise create, join, ready, start, persisted-state availability, reconnect restoration, and canvas visibility against a real Supabase test project when `LIVE_SUPABASE_E2E=1` and Supabase env vars are configured.

### P3 — Player Authentication — COMPLETE
- **Status:** Done
- **Notes:** Full Supabase Auth implementation with email/password.
  - **Redux slice**: `authSlice.ts` stores user info (id, email, displayName, createdAt), loading state, and errors.
  - **AuthService**: Singleton service wrapping Supabase Auth with `signUp`, `signIn`, `signOut`, `resetPassword` methods. Initializes on app load and listens to auth state changes.
  - **useAuth hook**: Convenience hook exposing auth state and actions.
  - **Login/Signup UI**: New views in GameLobby for sign in and sign up forms with email, password, and display name fields.
  - **User profile**: When logged in, user profile (display name + email) appears in top-right of main menu with sign out button.
  - **Auto-fill name**: When authenticated, player name field auto-fills with user's display name.
  - **Guest play**: Users can still play without signing in - auth is optional.
  - **2026-06-09 hardening:** Missing Supabase environment variables no longer crash the app. Local play renders normally; auth/online actions report a configuration error.

---

## Phase G: Hex Graphics & Production Hardening

### G1 — Hex Board Renderer Upgrade — COMPLETE
- **Status:** Done
- **Notes:** The Phaser board renderer now uses darker canvas background, stronger grid contrast, layered gradient hex fills, terrain-specific vector decoration, inactive-tile hatching, team-coloured player badges, and hero class markers.
- **2026-06-09 enhancement:** Added under-tile shadows, wider hover/selection halos, class-coloured hero badge backgrounds, and hero HP rings so commanders are readable on the board without opening the hero panel.
- **2026-06-09 material pass:** Added beveled top-down rims, deterministic tile grain, lake glints, river banks/highlights, mountain ridge lines, desert texture, plains grass tufts, and denser forest canopy detail inside the existing tile graphics object lifecycle.
- **Runtime fix:** Replaced unsupported Phaser `Graphics.quadraticCurveTo` calls with segmented line drawing after browser smoke exposed the runtime error.

### G2 — Browser Smoke / Runtime Resilience — COMPLETE
- **Status:** Done
- **Notes:** In-app browser verified the lobby renders without Supabase env and exposed runtime issues that were fixed. Playwright now provides repeatable repo coverage through `npm run test:e2e`: it starts a two-player local game, checks the running round HUD, verifies the Hero Command control, confirms a single visible Phaser canvas, checks canvas dimensions, and captures the rendered canvas. A second Playwright test fills a 30-player local roster through the UI, starts the game, checks startup timing, samples animation-frame responsiveness immediately and after a sustained post-start window, optionally checks heap sanity, and captures the rendered canvas.

### G3 — Domain Test Harness — COMPLETE
- **Status:** Done
- **Notes:** Added Vitest and wired `npm run check` to typecheck, lint, and run tests. Current coverage includes combat engine calculations/resolution, reducer-level hero/combat flows, Supabase-not-configured fallbacks, audited action player-ID derivation, realtime diagnostics, diagnostics export request/event helpers, session authority request envelopes, persisted game/world-state hash coverage, persisted-state restore validation, sequenced state-sync envelopes/stale rejection, state-sync dedupe decisions, state-sync payload budget warnings, multiplayer action-creator payload contracts, host-authoritative realtime action handling and validation, invalid action rejection, negative trade-resource rejection, malformed state-sync rejection, deferred disconnect finalization, mocked realtime channel lifecycle handling, session/reconnect persistence contracts, reconnect identity resolution, and 30-player full-roster start regression.

### G4 — Production Bundle Splitting — COMPLETE
- **Status:** Done
- **Notes:** `GameCanvas` is lazy-loaded so the lobby shell no longer eagerly downloads Phaser. Vite manual chunks split Phaser, Supabase, React/Redux, icons, and vendor code; the isolated Phaser engine chunk has an explicit warning budget.

### G5 — Dependency Metadata Refresh — COMPLETE
- **Status:** Done
- **Notes:** Refreshed Browserslist/caniuse-lite data with `npx update-browserslist-db@latest`; production build output no longer reports outdated Browserslist data. Production audit now passes with 0 vulnerabilities after safe dependency updates and a targeted `brace-expansion` override. Unused runtime dependencies (`axios`, `react-router-dom`, and `react-spring`) were removed, cutting 317 installed packages and eliminating the stale `react-spring` peer-warning tree.

### G6 — Vite 8 Tooling Migration — COMPLETE
- **Status:** Done
- **Notes:** Migrated to `vite@8.0.16`, `@vitejs/plugin-react@6.0.2`, and `vitest@4.1.8`. Full audit now reports 0 vulnerabilities, clearing the previous dev-server-only esbuild advisory. Production build remains chunked and passes under the new Rolldown-backed Vite output.

### G7 — Live Online Multiplayer E2E Harness — COMPLETE
- **Status:** Done
- **Notes:** Added stable data-test IDs for the online create/join/reconnect lobby paths and a gated Playwright live smoke in `e2e/live-online-multiplayer.spec.ts`. The spec is skipped by default, and runs only with `LIVE_SUPABASE_E2E=1`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. It uses three browser contexts to create a host session, join a guest, ready/start the game, wait for host persistence, reconnect from a fresh context, verify the live canvas, and best-effort mark the created session ended.

### G8 — Production Readiness Runbook — COMPLETE
- **Status:** Done
- **Notes:** Added `ProductionReadiness.md` with release gates, live Supabase E2E setup, Supabase/RLS checklist, environment configuration, diagnostics export options, dependency maintenance policy, and remaining deployment decisions.

### G9 — Long-Soak Browser Profile Harness — COMPLETE
- **Status:** Done
- **Notes:** Added `e2e/local-soak.spec.ts`, gated by `SOAK_E2E=1`, with configurable `SOAK_E2E_DURATION_MS`. The spec fills a 30-player local game, starts the Phaser scene, samples animation frames every 5 seconds for the configured duration, checks optional heap data, and fails on console errors.

### G10 — CI Quality Gates — COMPLETE
- **Status:** Done
- **Notes:** Added `.github/workflows/ci.yml` to run `npm ci`, Playwright Chromium install, `npm run check`, `npm run build`, `npm audit --audit-level=moderate`, and default `npm run test:e2e` on pull requests and pushes to `main`/`master`.

### G11 — Supabase Data Integrity Hardening — COMPLETE
- **Status:** Done
- **Notes:** Added `supabase/migrations/20260609232000_harden_game_session_integrity.sql` with future-write checks for session codes, game modes, player counts, saved JSON state shape, turn phases, and action types, plus an ended-session cleanup index and `delete_ended_game_sessions(...)` helper.

### G12 — Realtime Diagnostics Sink — COMPLETE
- **Status:** Done
- **Notes:** Added `supabase/migrations/20260609233000_create_realtime_diagnostics.sql` and `supabase/functions/realtime-diagnostics/index.ts` so `VITE_REALTIME_DIAGNOSTICS_ENDPOINT` can target a Supabase Edge Function that validates and stores sanitized diagnostics, including rejected malformed state-sync snapshots and disconnect grace-window expirations.

### G13 — Canvas Error Recovery — COMPLETE
- **Status:** Done
- **Notes:** Added a Suspense loading fallback and React error boundary around the lazy `GameCanvas` import. Phaser/chunk failures now show an accessible recovery panel with retry instead of leaving a blank play surface.

### G14 — Session Authority Gateway — COMPLETE
- **Status:** Done
- **Notes:** Added `supabase/functions/session-authority/index.ts` and `supabase/migrations/20260609235000_add_session_authority_gateway.sql`. Production can deploy the Edge Function and set `VITE_SESSION_AUTHORITY_ENDPOINT` so gateway-created sessions store a hashed host authority token and reject direct anonymous session updates/turn-history inserts. Direct Supabase writes remain as a local/dev fallback for sessions without an authority token.

---

## Progress Summary

| Phase | Total Items | OPEN | IN PROGRESS | COMPLETE |
|-------|------------|------|-------------|---------|
| C — Dead Code | 1 | 0 | 0 | 1 |
| M — Game Mechanics | 4 | 0 | 0 | 4 |
| I — Item System | 7 | 0 | 0 | 7 |
| H — Hero System | 10 | 0 | 0 | 10 |
| B — Building System | 1 | 0 | 0 | 1 |
| P — Infrastructure | 3 | 0 | 0 | 3 |
| G — Hex Graphics & Production Hardening | 14 | 0 | 0 | 14 |
| **TOTAL** | **40** | **0** | **0** | **40** |

---

## Recommended Implementation Order

Work through items in this sequence to respect dependencies and deliver value incrementally:

1. **C1** — Remove GameHUD dead code (cleanup, unblocks clarity)
2. **M4** — Plains HP gain (isolated, 15-minute fix)
3. **I1–I4** — Special item effects (terraform, leech, armageddon, rejuvenate)
4. **I5–I6** — Boat storm / climbing gear survival mechanics
5. **I7** — Global item quantity limits (local enforcement first)
6. **M1** — Bartering phase (standalone mechanic)
7. **H1–H10** — Hero state, recruitment, army, skills, movement, leveling, spells, and units
8. **M2** — Combat system
9. **M3** — Victory conditions
10. **B1** — Building system decision (removed as legacy)
11. **P1** — Real-time multiplayer
12. **P2** — Session persistence
13. **P3** — Player authentication
14. **G1** — Hex renderer upgrade
15. **G7** — Gated live online multiplayer E2E harness
16. **G8** — Production readiness runbook
17. **G9** — Long-soak browser profile harness
18. **G10** — CI quality gates
19. **G11** — Supabase data-integrity hardening
20. **G12** — Realtime diagnostics sink
21. **G13** — Canvas error recovery
22. **G14** — Session authority gateway

## Next production-hardening prompt

Continue from the 2026-06-09 tranche. Priorities:

1. Run `LIVE_SUPABASE_E2E=1 npm run test:e2e` against a Supabase test project and record the live create/join/reconnect plus persisted-state restoration result.
2. Run `SOAK_E2E=1 SOAK_E2E_DURATION_MS=60000 npm run test:e2e` in CI or a configured local profile window and tune the release threshold/cadence.
3. Deploy and validate the optional session authority gateway against a Supabase test project, then decide whether gameplay actions also need a fully server-authoritative simulation layer.
4. Decide whether the included realtime diagnostics Edge Function is the final sink or a forwarding layer to another monitoring platform.

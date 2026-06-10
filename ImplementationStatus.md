# Implementation Status & Bug Fix Plan

**Last updated:** 2026-06-10 — hero/combat UI, multiplayer action routing/auditing, local action ownership checks, host action/state-sync validation, host-control authorization, actor/session action-rate limiting, persisted-state restore/status validation, session-scoped ordered/deduplicated state-sync and host-migration delivery, throttled state-sync payload budget diagnostics, disconnect grace-window handling, optional session authority gateway, Supabase runtime guard, realtime diagnostics export and sink, Supabase data-integrity hardening, enhanced material-rich hex/hero board visuals, canvas error recovery, focused domain/realtime/session/E2E tests with canvas pixel-richness assertions, manual live Supabase CI E2E gate, locally verified long-soak profile, scheduled/manual long-soak CI gate, Supabase Edge Function CI typecheck, production readiness runbook, 30-player load and sustained browser-runtime profiling, reconnect identity hardening, persistence hash coverage, production chunk splitting, Vite 8 migration, and clean dependency audit.

## Overview

Full codebase audit of the Heroes & Kingdoms Phaser game. This document catalogs every critical bug, logic error, performance issue, and architectural problem found, organized into actionable phases for systematic resolution before any new feature work begins.

---

## 2026-06-09 Production Readiness Tranche -- COMPLETE

### Completed

- Added playable hero command surfaces for recruitment, hero rest, army recruitment, skill learning, spell casting, and adjacent combat.
- Added combat result feedback overlay and activity-log support for hero/combat events.
- Routed online-mode movement, harvesting, crafting, item use, trading, hero, army, spell, and combat actions through the host-authoritative realtime service.
- Fixed multiplayer player identity drift by allowing `joinGame` to accept the client/host player ID.
- Added local action ownership checks so a client refuses to emit player-owned realtime actions for a different local player ID before broadcast or host-local dispatch.
- Hardened persistence hashing so host auto-save sees full game/world-state changes, not only phase/count changes.
- Guarded Supabase auth/realtime startup so missing env vars no longer blank-screen local play.
- Added non-blocking host-routed action audit logging to `game_turn_history`.
- Added in-service realtime diagnostics for missing channels, failed action broadcasts, failed state-sync broadcasts, failed persistence saves, failed audit writes, player-count update failures, and disconnect update failures.
- Added realtime diagnostics export via browser `hex:realtime-diagnostic` events and optional `VITE_REALTIME_DIAGNOSTICS_ENDPOINT` POST requests.
- Added a Supabase `realtime_diagnostics` table migration and `realtime-diagnostics` Edge Function reference sink for the optional diagnostics endpoint.
- Added host-side realtime action validation before dispatch/state sync/audit, covering lobby joins/readiness/start, movement, harvesting, crafting, item use, trades, heroes, skills, spells, units, combat, phase control, and negative-resource trade rejection.
- Added host-control authorization for start, force-next-phase, and end-game actions. These realtime actions now carry the actor player ID and are rejected unless the actor is the current host.
- Added per-actor and per-session host action-rate limiting before validation dispatch, state sync, or audit logging. Rejected floods emit `action_rate_limited` diagnostics and are tunable with `VITE_HOST_ACTION_RATE_LIMIT_MAX_ACTIONS`, `VITE_HOST_ACTION_RATE_LIMIT_SESSION_MAX_ACTIONS`, and `VITE_HOST_ACTION_RATE_LIMIT_WINDOW_MS`.
- Added client-side state-sync validation before applying host snapshots, covering malformed game mode/phase/player/team/stat/hero data, invalid world tiles, terrain keys, coordinate-key mismatches, and active-tile references. Rejected snapshots emit an `invalid_state_sync` realtime diagnostic.
- Added persisted-state restore validation for in-progress joins and reconnects so corrupt Supabase `game_state`/`world_state` snapshots are rejected before Redux sync.
- Added persisted-state validity to active-session summaries and the reconnect UI so invalid saved state is shown before reconnect is attempted.
- Added session-scoped sequenced host state-sync envelopes with state hashes and timestamps. Clients reject malformed, wrong-session, and stale/out-of-order sequenced snapshots while preserving compatibility with legacy unsequenced payloads.
- Added exact-match state-sync broadcast deduplication so redundant host sync requests do not resend unchanged game/world snapshots after a successful broadcast.
- Added state-sync payload byte measurement and throttled `state_sync_payload_large` warnings when snapshots exceed the configurable `VITE_STATE_SYNC_WARN_BYTES` budget.
- Added session-scoped host-migration payload validation so clients reject migration broadcasts that do not match the active session before promotion.
- Added a realtime presence disconnect grace window. Presence leaves now mark players disconnected immediately, but game removal and host migration are delayed until the player remains absent after the configurable timeout; rejoins cancel the pending finalization.
- Added an optional Supabase `session-authority` Edge Function and `VITE_SESSION_AUTHORITY_ENDPOINT` client path so production host session creation, persistence saves, player-count updates, turn-audit writes, host claims, and session-end writes can be owned by a service-role gateway using hashed host authority tokens.
- Added a Supabase authority-gateway migration that stores host token hashes and blocks direct anonymous updates/turn-history writes for gateway-created sessions while preserving local direct-write fallback for sessions without authority tokens.
- Added a Supabase data-integrity migration for session-code, game-mode, player-count, JSON-state, turn-phase, and action-type checks, plus ended-session cleanup indexing/function support.
- Upgraded Phaser hex graphics with darker board background, stronger grid contrast, gradient terrain fills, terrain vector details, inactive-tile hatching, team-coloured player badges, and hero markers.
- Enhanced board readability with under-tile shadows, wider hover/selection halos, class-coloured hero badges, and hero HP rings on map markers.
- Added a material-rich hex surface pass with beveled top-down rims, deterministic tile grain, lake glints, river banks/highlights, mountain ridge lines, desert texture, plains grass tufts, and denser forest canopy detail while staying inside the existing dirty-tile graphics lifecycle.
- Added optimized terrain contour rings and terrain-coloured edge accents to the Phaser hex renderer, keeping the richer board surface within the existing 30-player browser frame thresholds.
- Added a lazy-canvas loading fallback and error boundary with retry so Phaser/chunk failures no longer leave the play surface blank.
- Removed legacy building guide/data files in line with the hero/army/combat direction.
- Added Vitest with focused tests for combat power/resolution, multiplayer-supplied player IDs, hero recruitment, skill learning, spell casting, unit recruitment, rest, and combat report creation.
- Added persistence hash coverage proving both game-state and world-state changes are included in host auto-save deduplication.
- Added pure multiplayer action-creator and local action ownership contracts so movement, trading, hero, spell, combat, and host-control payloads are covered independently of a live realtime backend.
- Extracted and tested host-authoritative realtime action processing so local contract tests now cover non-host ignore behaviour, host join/move/start/end effects, invalid action rejection, negative trade-resource rejection, state-sync triggers, malformed/wrong-session sync rejection, player-count update triggers, and audit queuing without a live Supabase project.
- Extracted and tested mocked realtime channel lifecycle adapters for state sync, host migration, presence join/leave, deferred disconnect handling callbacks, rejoin cancellation checks, and deterministic next-host selection.
- Extracted and tested session/reconnect persistence contracts for join rejection reasons, active-session summaries, persisted reconnect restoration, no-state sessions, ended sessions, query failures, and missing-player reconnects.
- Fixed reconnect player resolution to prefer durable player IDs before falling back to display-name matching.
- Added a 30-player reducer regression that fills the full player cap, verifies unique IDs/numbers, checks balanced configured team allocation, and starts the game from the full roster.
- Added Playwright browser-runtime profiling for a 30-player local game, including full roster creation through the UI, startup timing, startup frame-sampling thresholds, sustained post-start frame sampling, optional heap sanity checks, canvas screenshot capture, PNG pixel-richness assertions, and console-error checks.
- Added Playwright E2E smoke coverage for the local-game path, including lobby start, running HUD visibility, Hero Command control presence, Phaser canvas mount, canvas sizing, rendered canvas screenshot capture, and PNG pixel-richness assertions for material-rich board detail.
- Added stable online lobby test selectors and a gated live Supabase Playwright smoke for create, join, ready, start, persisted-state check, reconnect restoration, canvas visibility, canvas PNG pixel-richness assertions, and best-effort test-session cleanup. It runs only when `LIVE_SUPABASE_E2E=1` and Supabase test-project env vars are present.
- Added an opt-in 30-player long-soak Playwright profile gated by `SOAK_E2E=1` and configurable with `SOAK_E2E_DURATION_MS`.
- Added `.github/workflows/ci.yml` to run install, typecheck/lint/unit, production build, Supabase Edge Function typecheck via `npm run check:edge`, audit, and default Playwright browser E2E on pull requests and pushes to `main`/`master`, plus a scheduled/manual 30-player long-soak browser profile and a manual live Supabase online smoke that uses repository secrets.
- Added `ProductionReadiness.md` covering release gates, live Supabase E2E setup, Supabase/RLS checklist, environment configuration, diagnostics export options, dependency maintenance policy, and remaining deployment decisions.
- Split production chunks so the lobby shell no longer eagerly loads Phaser. `GameCanvas` is lazy-loaded, vendor/supabase/react/icon chunks are separated, and the isolated Phaser engine chunk has an explicit warning budget.
- Refreshed Browserslist/caniuse-lite data; build output no longer emits the outdated Browserslist warning.
- Cleared production dependency audit findings by applying safe dependency updates and a targeted `brace-expansion` override for the vulnerable ESLint/minimatch subtree.
- Upgraded ESLint, TypeScript-ESLint, Playwright, and Vitest within current compatible major ranges as part of the Vite 8 tooling migration.
- Removed unused runtime dependencies (`axios`, `react-router-dom`, and `react-spring`), cutting 317 installed packages and removing the stale `react-spring` React peer-warning tree.
- Completed the Vite 8 tooling migration (`vite@8.0.16`, `@vitejs/plugin-react@6.0.2`, `vitest@4.1.8`), clearing the remaining dev-server-only esbuild audit advisory.

### Verification

- `npm run check` -- pass (`typecheck`, `lint:check`, and `vitest run`; 5 test files / 53 tests).
- `npm run build` -- pass; output is chunked into `index`, `GameCanvas`, `phaser`, `react-vendor`, `supabase`, `icons`, and `vendor`.
- `npm run check:edge` -- pass; Deno typecheck for `realtime-diagnostics` and `session-authority` through the npm Deno shim.
- `npm run test:e2e` -- pass (Playwright Chromium; 2 local-game smoke/profile tests passed, 1 live Supabase online test skipped because `LIVE_SUPABASE_E2E` and Supabase env vars are not configured locally, and 1 long-soak test skipped because `SOAK_E2E` is not enabled). Local coverage includes a two-player canvas smoke and a 30-player UI-driven local game profile with startup timing, sustained frame sampling, optional heap sanity checks, canvas capture, and PNG pixel-richness checks for rendered board colour/detail/contrast.
- `SOAK_E2E=1 SOAK_E2E_DURATION_MS=60000 npm run test:e2e` -- pass (Playwright Chromium; 3 tests passed, 1 live Supabase online test skipped because live Supabase env vars are not configured). The opt-in 30-player long-soak browser profile completed its sustained 60-second run with frame sampling, optional heap checks, and console-error checks.
- `npm audit --omit=dev --audit-level=moderate` -- pass; 0 production vulnerabilities.
- `npm audit --audit-level=moderate` -- pass; 0 vulnerabilities.
- Browser smoke found and drove fixes for missing Supabase env blank-screening and unsupported Phaser `quadraticCurveTo` calls. Playwright now provides repeatable screenshot/canvas checks plus PNG byte-level colour/detail/contrast assertions that the in-app browser screenshot/CDP path could not reliably complete.

### Remaining hardening

- Run the gated live online E2E harness against a Supabase test project in CI or a configured local test environment, then record the live create/join/reconnect and persisted-state restoration result.
- Configure `SUPABASE_E2E_URL` and `SUPABASE_E2E_ANON_KEY` repository secrets before using the manual live Supabase workflow gate.
- Review scheduled/manual long-soak CI results and tune the release threshold/cadence.
- Deploy and validate the optional `session-authority` gateway against a Supabase test project, then decide whether gameplay actions also need to move to a fully server-authoritative simulation layer.
- Decide whether the included realtime diagnostics Edge Function is the final sink or a forwarding layer to another monitoring platform.

---

## Phase 1: Critical Runtime Bugs -- RESOLVED

All critical runtime bugs have been fixed.

### 1.1 Console.log in Game Loop (GameEngine.ts) -- FIXED
- Removed `console.log` from the `update()` method that was firing every frame.

### 1.2 Cursor Keys Recreated Every Frame (GameEngine.ts) -- FIXED
- Moved `createCursorKeys()` to `create()`, stored as class property `this.cursors`, removed recreation in `update()`.

### 1.3 Recursive Polling Without Cleanup (GameCanvas.tsx) -- FIXED
- Added timeout ID tracking, `clearTimeout` in cleanup, and max retry limit (50 attempts).

### 1.4 Missing Type Exports (buildingSystem.ts) -- REMOVED
- File was removed from the project (legacy code).

### 1.5 Item Type Mismatch: availableUses vs minUses/maxUses (gameSlice.ts) -- FIXED
- Changed `harvestFromTile` reducer to set `availableUses` (matching `consumeItemUse` and `craftItem` patterns) instead of overriding `minUses`/`maxUses`.

### 1.6 ActivityLog Auto-Scroll Direction (ActivityLog.tsx) -- NOT A BUG
- Events are prepended via `unshift` (newest first), so `scrollTop = 0` correctly scrolls to the newest events. Logic is consistent.

### 1.7 BuildingPanel Crash on Empty Cities (BuildingPanel.tsx) -- REMOVED
- File was removed from the project (legacy code).

### 1.8 Texture Name Conflict: sparkle-particle -- ALREADY RESOLVED
- The `TextureFactory` already uses unique keys (`sparkle-star-particle`, `sparkle-dot-particle`). Both `AnimationSystem` and `ParticleSystem` reference `TextureKeys` constants correctly.

---

## Phase 2: Null Safety & Runtime Errors -- RESOLVED

All null safety and runtime error issues have been fixed.

### 2.1 Unsafe Terrain Data Lookups (GameEngine.ts) -- FIXED
- Added optional chaining (`terrain?.icon`) in `renderTile` and early return guard in `_redrawTileGraphics`.

### 2.2 Non-Null Assertions on Optional Players Array (GameEngine.ts) -- FIXED
- Replaced `tile.players!.length` with a pre-computed `playerCount` variable captured before the forEach loop.

### 2.3 Unsafe Disaster Data Access (GameEngine.ts) -- ALREADY SAFE
- Existing code already has `if (!disaster) { return; }` guard on line 589.

### 2.4 Tile Lookup Without Null Check (GameEngine.ts) -- ALREADY SAFE
- Existing code already has `if (!tile) return null;` guard on line 620.

### 2.5 Unsafe Tile Access in gameSlice Reducers -- FIXED
- Replaced all `state.tiles[tileKey].players!` patterns with local variable binding and removed non-null assertions across `joinGame`, `leaveGame`, `movePlayer`, and `removeEliminatedPlayers` reducers.

### 2.6 Non-Null Assertions in AnimationSystem -- FIXED
- Added `hexPoints.length === 0` guard before accessing array elements. Removed `!` assertions.

### 2.7 ParticleSystem Null Emitter Access -- ALREADY SAFE
- Existing code already has `if (emitter) { ... }` guard on line 251.

### 2.8 HexActionMenu Non-Null Assertion -- FIXED
- Replaced `currentPlayerStats!.actionPoints` with `currentPlayerStats?.actionPoints ?? 0`.

### 2.9 Environment Variable Parsing (gameData.ts) -- FIXED
- Simplified to `parseInt(...) || defaultValue` pattern, returning 10 and 3 as defaults for NaN.

### 2.10 GameCanvas Missing Error Handling -- FIXED
- Wrapped `new Phaser.Game(config)` in try-catch with early return on failure.

### 2.11 .ts Import Extensions (bonus) -- FIXED
- Removed `.ts` extensions from all import paths across 7 files: `gameSlice.ts`, `ActivityLog.tsx`, `HarvestGrid.tsx`, `HexActionMenu.tsx`, `buildingsData.ts`, `gameData.ts`, `harvestData.ts`, `utils.ts`.

---

## Phase 3: Memory Leaks & Performance

### 3.1 Full World Re-Render on Every Call (GameEngine.ts) - RESOLVED
- **Fix Applied:** Added `previousGameData` snapshot and `getDirtyTileKeys()` diff. `renderWorld(false)` now only redraws changed tiles. Full redraw only on initialization or when `gridNeedsRedraw` flag is set. Added `tileTerrainIcons` map for proper icon lifecycle tracking.

### 3.2 Event Listener Cleanup (GameEngine.ts) - RESOLVED
- **Fix Applied:** Added `this.events.on("shutdown", this.cleanup, this)` in `create()`. Cleanup now deregisters this listener as well.

### 3.3 Disabled Object Pooling (AnimationSystem.ts) - RESOLVED
- **Fix Applied:** Removed dead `PooledGraphics`/`PooledText` interfaces, pool arrays, and pool init/get/return methods. Replaced with simple `createGraphics()`/`destroyGraphics()`/`createText()`/`destroyText()` methods that track objects in an `activeGameObjects` Set. Removed stale console.logs from `setPerformanceMode()`.

### 3.4 Quadruple Tile Iteration on Clear (GameEngine.ts) - RESOLVED
- **Fix Applied:** Consolidated `clearTiles()` to destroy graphics, terrain icons, and player numbers from their respective Maps in a single pass. Removed orphan scan of `children.list`.

### 3.5 Sort on Every Render (GameEngine.ts) - RESOLVED
- **Fix Applied:** With dirty-tracking in 3.1, the grid only redraws on the `gridNeedsRedraw` flag, so the sort no longer runs on every `updateTiles()` call.

### 3.6 Duplicate ParticleEmitterManager Instances - RESOLVED
- **Fix Applied:** GameEngine now creates a single shared `ParticleEmitterManager` and passes it to both `AtmosphericParticleSystem` and `GameAnimationSystem` via constructor injection. GameEngine owns the manager lifecycle and destroys it during cleanup.

### 3.7 Orphaned Ray Sprites on Animation Cancel - RESOLVED
- **Fix Applied:** Light ray images and disaster sprites are now tracked in `activeGameObjects`. `cancelAllAnimations()` destroys all tracked game objects along with stopping tweens, preventing orphaned sprites.

---

## Phase 4: Logic Errors & Broken Features

### 4.1 Keyboard Camera Movement Unimplemented (GameEngine.ts) - RESOLVED
- **Note:** Was already implemented in Phase 1 fixes. `update()` correctly moves camera on arrow key input using `this.cursors`.

### 4.2 Preload Method Completely Stubbed (GameEngine.ts) - RESOLVED
- **Fix Applied:** Removed all 13 commented-out `this.load.image()` calls and the `console.log`. Game relies solely on procedural texture generation via `TextureFactory`. Empty `preload()` retained as Phaser lifecycle stub.

### 4.3 Empty updateAtmosphericEffects Method (GameEngine.ts) - RESOLVED
- **Fix Applied:** Removed both the call site in `renderWorld()` and the empty method body entirely.

### 4.4 Hardcoded HeroPanel Stats (HeroPanel.tsx) - DEFERRED
- **Note:** Hero system is currently inactive. Deferred until hero feature is implemented.

### 4.5 Unimplemented Hero Buttons (HeroPanel.tsx) - DEFERRED
- **Note:** Hero system is currently inactive. Deferred until hero feature is implemented.

### 4.6 Commented-Out Tile Selection (HexActionMenu.tsx) - RESOLVED
- **Fix Applied:** Added `deselectTile` reducer to gameSlice (sets `selectedTile = null`). Replaced the two commented-out `dispatch(selectTile(null))` calls with `dispatch(deselectTile())`. Action menu now correctly dismisses after a move or non-persistent action.

### 4.7 Nearest City Not Actually Calculated (BuildingPanel.tsx) - DEFERRED
- **Note:** BuildingPanel.tsx was removed (legacy file). City feature deferred.

### 4.8 Inconsistent Activity Event Limits (gameSlice.ts) - RESOLVED
- **Fix Applied:** Added `MAX_ACTIVITY_EVENTS = 100` constant at the top of gameSlice. Replaced all three inconsistent `slice(0, 50/100)` calls with the constant.

### 4.9 Item Special Effects Not Enforced (harvestData.ts) - DEFERRED
- **Note:** Item special effect enforcement (boat storm destruction, climbing gear terrain lock) requires substantial game loop integration. Deferred as a planned feature.

### 4.10 Item Quantity Limits Not Enforced (harvestData.ts) - DEFERRED
- **Note:** Global item quantity tracking requires server-side or shared state. Deferred as a planned feature.

### 4.11 RoundPhaseOverlay Variable Scope Issues - RESOLVED
- **Note:** Switch case blocks are already wrapped in explicit `{ }` block scopes. Removed the stale commented-out `console.log` from `phaseProgress` calculation.

### 4.12 Invalid Tailwind Class (BoltLogo.tsx) - RESOLVED
- **Fix Applied:** Changed `hover:scale-205` (invalid) to `hover:scale-110` and `active:scale-200` to `active:scale-95`.

---

## Phase 5: Dead Code & Technical Debt Cleanup

### 5.1 Commented-Out Code Blocks - RESOLVED
- **GameEngine.ts**: Removed 16-line commented-out left/right face outline drawing block.
- **AnimationSystem.ts**: No commented-out pooling code found - was already clean.
- **GameCanvas.tsx**: Removed 17-line commented-out event-listener scene initialization block.
- **PanelManager.tsx**: File no longer exists - already removed.
- **BuildingPanel.tsx**: File no longer exists - already removed.
- **RoundPhaseOverlay.tsx**: Resolved in Phase 4.
- **gameSlice.ts**: Removed commented switch statement + removed unused `const apIncrement = 2` variable.

### 5.2 Unused Exports and Functions - RESOLVED
- **gameData.ts**: Removed `factions` const, `FactionData`/`UnitData`/`UnitStats`/`HeroData`/`HeroStats`/`SkillData` interfaces, `getFactionBuildings()` function, and the now-unused `buildingsData` import line. These were all hero/faction system stubs (inactive feature).
- **harvestData.ts**: `HarvestSlot`/`HarvestGrid`/`calculateItemValue`/`canCraftItem` are all actively used in `HarvestGrid.tsx` - no changes needed, original report was stale.
- **TextureFactory.ts**: Removed `ensureTextureExists()` method and its JSDoc block.
- **TileInfo.tsx**: Removed `isPartiallyVisible = false` variable and its conditional `opacity-75` usage.
- **HexActionMenu.tsx**: Removed `onOpenTileInfo` from `HexActionMenuProps` interface.

### 5.3 .ts Extension in Import Paths - RESOLVED
- All import paths already use extension-free paths. No changes needed.

### 5.4 Global State Pollution (GameEngine.ts) - RESOLVED
- **Fix Applied:** Created `src/game/phaserRef.ts` module with `setPhaserGame`/`getPhaserGame`/`clearPhaserGame` functions. Updated `GameEngine.ts` to call `setPhaserGame` on create and `clearPhaserGame` on cleanup. Updated `HexActionMenu.tsx` to call `getPhaserGame()` instead of reading from `window`.

### 5.5 PanelManager Dead State - RESOLVED
- `PanelManager.tsx` no longer exists in the codebase - already removed in prior cleanup.

---

## Phase 6: Architecture & State Management -- RESOLVED

### 6.1 Monolithic Game Slice - RESOLVED
- **Fix Applied:** Split into three domain slices: `worldSlice` (tiles, selectedTile, activeTiles), `uiSlice` (showGrid, cameraPosition, zoomLevel, showPlayerNumbers, showTileInfo), and `gameSlice` (players, phase, activity log). Added `listenerMiddleware` to sync tile.players in worldSlice whenever player movement/join/leave/phase actions fire. Shared types extracted to `types.ts`. All consumers updated to read from correct slices.

### 6.2 buildingSystem.ts State Mutation Pattern - N/A
- **Note:** `buildingSystem.ts` was already removed from the project as legacy code. No action needed.

### 6.3 buildingsData.ts Const vs Array Typing - RESOLVED
- **Fix Applied:** Changed declaration from `export const buildingDatabase: BuildingData[] = [...] as const` to `export const buildingDatabase = [...] as const satisfies readonly BuildingData[]`. This correctly signals both immutability and type constraints without contradiction.

### 6.4 Missing React Keys in List Renders - RESOLVED
- **HarvestGrid.tsx**: Changed resource slot key from `index` to `resourceData.id`; changed player items key from `index` to `${item.id}_${index}`.
- **BuildingGuide.tsx**: Changed benefit list key from `i` to `benefit` (the string value itself).
- **PartyGameHUD.tsx / BuildingPanel.tsx**: Already using stable IDs or file was removed.

### 6.5 Alert-Based Validation - RESOLVED
- **Fix Applied:** Replaced all 9 `alert()` calls in `HarvestGrid.tsx` with a `flashMessage` state. Messages auto-dismiss after 3 seconds. Error messages shown in red, success messages (crafted item) shown in green, displayed inline in the panel header.

---

## Phase 7: Performance Mode & Configuration -- RESOLVED

### 7.1 Magic Numbers Throughout Codebase - RESOLVED
- **Fix Applied:** Created `src/game/GameConfig.ts` with a single `GameConfig` const object containing all magic numbers, organized into logical groups: `camera` (speed, zoom bounds, zoom factors, background color), `rendering` (all depth values), `animation` (particle counts, ring counts, ray counts, HUD position, disaster timing), and `canvas` (polling interval, max attempts, resize debounce, min height). Updated `GameEngine.ts`, `AnimationSystem.ts`, and `GameCanvas.tsx` to reference `GameConfig` throughout.

### 7.2 Performance Mode Only Partial - RESOLVED
- **Fix Applied:** Added `PerformanceSettings` interface to `GameConfig.ts` with `setPerformanceMode(enabled: boolean): void` and `getPerformanceMode(): boolean`. Both `GameAnimationSystem` and `AtmosphericParticleSystem` now implement this interface. Added the missing `getPerformanceMode()` method to `GameAnimationSystem`.

### 7.3 No Responsive Canvas Handling - RESOLVED
- **Fix Applied:** Added a `useEffect` in `GameCanvas.tsx` that listens for `window.resize` events and debounces them at `GameConfig.canvas.resizeDebounceMs` (150ms). On resize, calls `gameRef.current.scale.resize(width, height)` to update Phaser's internal dimensions. Cleanup removes the event listener and clears any pending debounce timer.

---

## Summary Table

| Phase | Focus Area | Issue Count | Severity |
|-------|-----------|-------------|----------|
| 1 | Critical Runtime Bugs | 8 | CRITICAL |
| 2 | Null Safety & Runtime Errors | 10 | HIGH |
| 3 | Memory Leaks & Performance | 7 | HIGH |
| 4 | Logic Errors & Broken Features | 12 | MEDIUM-HIGH |
| 5 | Dead Code & Tech Debt | 5 categories | MEDIUM |
| 6 | Architecture & State Management | 5 | MEDIUM |
| 7 | Performance & Configuration | 3 | LOW-MEDIUM |

**Total distinct issues cataloged: 50+**

---

## Recommended Execution Order

1. **Phase 1** should be completed first as it contains crash-causing and performance-destroying bugs.
2. **Phase 2** next, to stabilize runtime behavior and prevent intermittent crashes.
3. **Phase 3** to stop memory leaks before they compound during longer play sessions.
4. **Phase 4** to fix broken game features players can observe.
5. **Phases 5-7** can be interleaved with new feature work as refactoring tasks.

No new feature development (multiplayer, combat, trading) should begin until Phases 1-3 are resolved, as those bugs will cascade into any new systems built on top of the current foundation.

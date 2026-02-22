# Implementation Status & Bug Fix Plan

## Overview

Full codebase audit of the Heroes & Kingdoms Phaser game. This document catalogs every critical bug, logic error, performance issue, and architectural problem found, organized into actionable phases for systematic resolution before any new feature work begins.

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

### 5.1 Commented-Out Code Blocks
Remove all commented-out code to improve readability. Key locations:
- `src/game/GameEngine.ts` ~lines 41-53 (preload assets), ~lines 427-442 (outline drawing)
- `src/game/AnimationSystem.ts` ~lines 65-71, 107-114, 146-154 (disabled pooling)
- `src/components/GameCanvas.tsx` ~lines 78-94 (alternative event listener setup)
- `src/components/UI/PanelManager.tsx` ~lines 36-40, 46, 70-77, 80 (commented-out useEffect and console.log)
- `src/components/UI/BuildingPanel.tsx` ~lines 116, 335, 345, 352 (commented console.log)
- `src/components/UI/RoundPhaseOverlay.tsx` ~line 219 (commented console.log)
- `src/store/gameSlice.ts` ~lines 701-706 (commented switch statement)

### 5.2 Unused Exports and Functions
Remove or implement:
- `src/data/gameData.ts`: `factions` array (one incomplete faction), `getFactionBuildings()` (never called), `FactionData`/`UnitData`/`HeroData`/`SkillData` interfaces (never used)
- `src/data/harvestData.ts`: `HarvestSlot`/`HarvestGrid` class (never imported), `calculateItemValue()` (never called), `canCraftItem()` (never called)
- `src/game/TextureFactory.ts` ~line 71-84: `ensureTextureExists()` (defined but never called)
- `src/components/UI/TileInfo.tsx` ~line 29: `isPartiallyVisible` (hardcoded to false, never changes)
- `src/components/UI/HexActionMenu.tsx` ~line 22: `onOpenTileInfo` prop (defined but never used)

### 5.3 .ts Extension in Import Paths
Non-standard `.ts` extensions in import paths may break production builds:
- `src/store/gameSlice.ts` ~line 114: `"../utils/utils.ts"` -> `"../utils/utils"`
- `src/store/buildingSystem.ts` ~line 3: `.ts` extension
- `src/data/buildingsData.ts` ~line 3: `.ts` extension
- `src/data/gameData.ts` ~line 4: `.ts` extension
- `src/data/harvestData.ts` ~line 2: `.ts` extension

### 5.4 Global State Pollution (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 64
- **Issue:** `(window as any).phaserGame = this.game` stores the game instance on the global window object.
- **Fix:** Remove or replace with a proper reference management pattern.

### 5.5 PanelManager Dead State
- **File:** `src/components/UI/PanelManager.tsx` ~line 36-40
- **Issue:** `screenSize` state is declared with `@ts-expect-error` and never used.
- **Fix:** Remove the dead state declaration.

---

## Phase 6: Architecture & State Management

### 6.1 Monolithic Game Slice
- **File:** `src/store/gameSlice.ts`
- **Issue:** All game state lives in a single massive Redux slice. This makes the file extremely large, hard to maintain, and prone to reducer conflicts.
- **Fix:** Split into domain slices: `playerSlice`, `tileSlice`, `phaseSlice`, `inventorySlice`, etc. Use Redux Toolkit's `combineSlices` or standard `combineReducers`.

### 6.2 buildingSystem.ts State Mutation Pattern
- **File:** `src/store/buildingSystem.ts` ~lines 101-111, 199, 210
- **Issue:** Functions directly mutate `gameState` objects passed as parameters. While this works inside Immer-powered reducers, it makes these functions unsafe to call outside reducers and violates pure function principles.
- **Fix:** Refactor to return new state objects instead of mutating parameters, or clearly document that these must only be called within Immer contexts.

### 6.3 buildingsData.ts Const vs Array Typing
- **File:** `src/data/buildingsData.ts` ~line 61, 557
- **Issue:** `buildingDatabase` is typed as `BuildingData[]` but also declared `as const`, creating contradictory mutability signals.
- **Fix:** Use `as const satisfies readonly BuildingData[]` or remove the `as const`.

### 6.4 Missing React Keys in List Renders
Multiple components use `index` as key or omit keys entirely in `.map()` calls:
- `src/components/UI/HarvestGrid.tsx` ~lines 261, 305, 402, 578
- `src/components/UI/BuildingGuide.tsx` ~line 154
- `src/components/UI/PartyGameHUD.tsx` ~lines 303, 323
- `src/components/UI/BuildingPanel.tsx` ~lines 329, 456
- **Fix:** Use stable, unique identifiers as keys.

### 6.5 Alert-Based Validation (HarvestGrid.tsx)
- **File:** `src/components/UI/HarvestGrid.tsx` ~lines 59, 64, 69, 74, 79, 98-100
- **Issue:** Uses `alert()` for validation feedback, blocking the UI thread and providing poor UX.
- **Fix:** Replace with in-component error messages or toast notifications.

---

## Phase 7: Performance Mode & Configuration

### 7.1 Magic Numbers Throughout Codebase
Hardcoded values scattered across all files:
- `GameEngine.ts`: Camera speed (5), zoom bounds (0.5-2), depth offset (-1000), background color (#2D5016)
- `AnimationSystem.ts`: Particle counts (8, 15), ring counts (5, 10), ray counts (4, 8), HUD position (100, 50), scaling multipliers
- `GameCanvas.tsx`: Polling interval (100ms)
- **Fix:** Extract all magic numbers to a central `GameConfig.ts` constants file.

### 7.2 Performance Mode Only Partial (AnimationSystem vs ParticleSystem)
- `AnimationSystem.ts` has `performanceMode` flag
- `ParticleSystem.ts` has no performance mode support
- **Fix:** Create shared `PerformanceSettings` interface, apply consistently across all systems.

### 7.3 No Responsive Canvas Handling
- **File:** `src/components/GameCanvas.tsx` ~lines 38-39
- **Issue:** Uses `window.innerWidth` and `window.innerHeight` at initialization only. No resize listener.
- **Fix:** Add window resize event listener with debounce, update Phaser game dimensions.

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

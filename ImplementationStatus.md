# Implementation Status & Bug Fix Plan

## Overview

Full codebase audit of the Heroes & Kingdoms Phaser game. This document catalogs every critical bug, logic error, performance issue, and architectural problem found, organized into actionable phases for systematic resolution before any new feature work begins.

---

## Phase 1: Critical Runtime Bugs (Must Fix First)

These issues cause crashes, infinite loops, or fundamentally broken behavior.

### 1.1 Console.log in Game Loop (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 122
- **Issue:** `console.log("GameScene > update()")` fires every single frame, flooding the console and degrading performance significantly.
- **Fix:** Remove the console.log call entirely.

### 1.2 Cursor Keys Recreated Every Frame (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 124
- **Issue:** `this.input.keyboard?.createCursorKeys()` is called inside `update()`, creating new cursor key objects on every frame tick instead of once in `create()`.
- **Fix:** Move cursor key creation to `create()`, store reference as class property, use stored reference in `update()`.

### 1.3 Recursive Polling Without Cleanup (GameCanvas.tsx)
- **File:** `src/components/GameCanvas.tsx` ~line 57-71
- **Issue:** `checkForScene()` calls itself via `setTimeout` recursively. If the scene never initializes or the component unmounts during polling, the timeout chain continues indefinitely causing memory leaks.
- **Fix:** Store the timeout ID and clear it in the useEffect cleanup function. Add a max retry count.

### 1.4 Missing Type Exports (buildingSystem.ts)
- **File:** `src/store/buildingSystem.ts` ~line 2
- **Issue:** Imports `Building`, `City`, `GameState` from `./gameSlice` but these types are not exported (or not defined) in gameSlice.ts. This is a compilation-breaking type mismatch.
- **Fix:** Define and export the `Building` and `City` interfaces from gameSlice.ts, or move them to a shared types file.

### 1.5 Item Type Mismatch: availableUses vs minUses/maxUses (gameSlice.ts)
- **File:** `src/store/gameSlice.ts` ~line 898-903
- **Issue:** When harvesting items, code assigns `minUses` and `maxUses` properties but the `ItemData` interface expects `availableUses`. This creates items with missing required fields.
- **Fix:** Assign `availableUses` correctly when creating harvested items. Remove `minUses`/`maxUses` from the spread.

### 1.6 ActivityLog Auto-Scroll Direction (ActivityLog.tsx)
- **File:** `src/components/UI/ActivityLog.tsx` ~line 47
- **Issue:** Auto-scroll sets `scrollTop = 0`, scrolling to the TOP of the log instead of the bottom. Users cannot see the most recent events.
- **Fix:** Set `scrollTop = scrollHeight` to scroll to the bottom.

### 1.7 BuildingPanel Crash on Empty Cities (BuildingPanel.tsx)
- **File:** `src/components/UI/BuildingPanel.tsx` ~line 26
- **Issue:** Always accesses `cities[0]` without checking if the cities array is empty. Crashes with undefined access if no cities exist.
- **Fix:** Add null/empty array guard before accessing cities.

### 1.8 Texture Name Conflict: sparkle-particle
- **Files:** `src/game/AnimationSystem.ts` ~line 91, `src/game/ParticleSystem.ts` ~line 63
- **Issue:** Both systems create a texture with key `'sparkle-particle'` but with different implementations (16x16 star vs 2x2 circle). Last to initialize wins, causing visual inconsistency.
- **Fix:** Rename to unique keys (`sparkle-star-particle`, `sparkle-dot-particle`) and update all references.

---

## Phase 2: Null Safety & Runtime Errors

These issues cause intermittent crashes under specific game conditions.

### 2.1 Unsafe Terrain Data Lookups (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~lines 177, 284
- **Issue:** `terrainData[tile.terrain]` accessed without null check. If terrain key is invalid, accessing `.icon`, `.color` etc. throws.
- **Fix:** Add null check before accessing terrain properties, provide fallback values.

### 2.2 Non-Null Assertions on Optional Players Array (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 218-219
- **Issue:** `tile.players!.length` uses non-null assertion but `players` is defined as optional (`players?: Player[]`).
- **Fix:** Replace `!` assertions with proper optional chaining and default values.

### 2.3 Unsafe Disaster Data Access (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 596
- **Issue:** `disasterData[disasterId]` accessed without null check before using `.name`.
- **Fix:** Add existence check before accessing disaster properties.

### 2.4 Tile Lookup Without Null Check (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 625-626
- **Issue:** `this.tiles.get(key)` could be undefined but is accessed with `.x` and `.y` on subsequent lines.
- **Fix:** Add undefined check after Map.get().

### 2.5 Unsafe Tile Access in gameSlice Reducers
- **File:** `src/store/gameSlice.ts` ~lines 488-492, 596, 612-613, 667
- **Issue:** Multiple reducers access `state.tiles[tileKey]` without checking existence, then access `.players` which could be undefined.
- **Fix:** Add null checks before all tile property access in reducers.

### 2.6 Non-Null Assertions in AnimationSystem
- **File:** `src/game/AnimationSystem.ts` ~lines 393, 395, 452-461
- **Issue:** `hexPoints[0]!.x` and similar assertions without validating array length.
- **Fix:** Add bounds checking before accessing array elements.

### 2.7 ParticleSystem Null Emitter Access
- **File:** `src/game/ParticleSystem.ts` ~line 250
- **Issue:** `getEmitter(emitterId)` could return undefined, but `.x` and `.y` are accessed without null check.
- **Fix:** Add undefined check after getEmitter call.

### 2.8 HexActionMenu Non-Null Assertion
- **File:** `src/components/UI/HexActionMenu.tsx` ~line 97-98
- **Issue:** `currentPlayerStats!.actionPoints` assumes stats exist without verification.
- **Fix:** Add proper null check.

### 2.9 Environment Variable Parsing (gameData.ts)
- **File:** `src/data/gameData.ts` ~line 261-262
- **Issue:** `parseInt(import.meta.env.VITE_REQUIRED_TEAMS)` returns NaN if env var is missing or invalid, causing silent downstream failures.
- **Fix:** Add fallback defaults: `parseInt(...) || defaultValue`.

### 2.10 GameCanvas Missing Error Handling
- **File:** `src/components/GameCanvas.tsx` ~line 53
- **Issue:** `new Phaser.Game(config)` can throw but is not wrapped in try-catch.
- **Fix:** Add try-catch around Phaser.Game initialization.

---

## Phase 3: Memory Leaks & Performance

### 3.1 Full World Re-Render on Every Call (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 140-145
- **Issue:** `renderWorld()` destroys and recreates ALL tile graphics objects every time it is called. No dirty-checking or incremental updates.
- **Fix:** Implement dirty flag system. Only re-render tiles that have changed since last render.

### 3.2 Event Listener Cleanup (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~lines 73-75
- **Issue:** Input event listeners registered in `create()` are cleaned up in `cleanup()` but not in the scene's built-in `shutdown`/`destroy` events. If scene is destroyed without explicit cleanup call, listeners leak.
- **Fix:** Register cleanup on scene `shutdown` event as well.

### 3.3 Disabled Object Pooling (AnimationSystem.ts)
- **File:** `src/game/AnimationSystem.ts` ~lines 63-82, 106-114, 145-154
- **Issue:** Object pool initialization and return logic is completely commented out. Graphics/Text objects are created and destroyed on every animation, causing GC pressure.
- **Fix:** Either re-enable and fix the pooling system, or remove the dead code entirely. If pooling is not needed, clean up the interfaces and unused code.

### 3.4 Quadruple Tile Iteration on Clear (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~lines 509-520
- **Issue:** Clearing tiles iterates the tile map twice (forEach on Maps) plus filters children.list. Inefficient for large maps.
- **Fix:** Consolidate into a single pass that clears all tile-related objects.

### 3.5 Sort on Every Render (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 455-461
- **Issue:** Sorts all tiles by depth every render call using a custom comparator. Expensive for large tile counts.
- **Fix:** Only sort when tiles change, or maintain sorted order during insertion.

### 3.6 Duplicate ParticleEmitterManager Instances
- **File:** `src/game/AnimationSystem.ts` ~line 58, vs `src/game/GameEngine.ts` ~line 84
- **Issue:** AnimationSystem creates its own ParticleEmitterManager instead of reusing the scene's instance. Redundant tracking and potential conflicts.
- **Fix:** Pass a shared ParticleEmitterManager instance to AnimationSystem.

### 3.7 Orphaned Ray Sprites on Animation Cancel
- **File:** `src/game/AnimationSystem.ts` ~line 609, 621-626
- **Issue:** `cancelAllAnimations()` stops tweens but does not destroy associated game objects (Graphics, Text, Image sprites), leading to orphaned objects.
- **Fix:** Track all animation-created objects alongside tweens, destroy them during cancellation.

---

## Phase 4: Logic Errors & Broken Features

### 4.1 Keyboard Camera Movement Unimplemented (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~lines 90-93
- **Issue:** Comment says "Handle camera movement in update loop" but the block is empty. Cursor keys are created but never used for movement.
- **Fix:** Implement camera panning using the created cursor keys, or remove the dead code if camera control is mouse-only.

### 4.2 Preload Method Completely Stubbed (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~lines 37-54
- **Issue:** Entire `preload()` method has 15 commented-out asset loading calls. Game loads no textures from disk.
- **Fix:** Either load the required assets or remove commented lines and rely solely on procedural texture generation.

### 4.3 Empty updateAtmosphericEffects Method (GameEngine.ts)
- **File:** `src/game/GameEngine.ts` ~line 504-505
- **Issue:** `updateAtmosphericEffects()` is called but the method body is empty.
- **Fix:** Implement or remove the call.

### 4.4 Hardcoded HeroPanel Stats (HeroPanel.tsx)
- **File:** `src/components/UI/HeroPanel.tsx` ~lines 83-98
- **Issue:** Stats (Attack: 8, Defense: 6, etc.) are hardcoded literals, never reflecting actual hero data.
- **Fix:** Wire up to actual hero stat data from the game state.

### 4.5 Unimplemented Hero Buttons (HeroPanel.tsx)
- **File:** `src/components/UI/HeroPanel.tsx` ~lines 122-126, 140-145
- **Issue:** "View Army", "Skills", "Cast Spell", and "Rest" buttons have no onClick handlers.
- **Fix:** Either implement handlers or disable/hide buttons until feature is ready.

### 4.6 Commented-Out Tile Selection (HexActionMenu.tsx)
- **File:** `src/components/UI/HexActionMenu.tsx` ~lines 81, 92
- **Issue:** Dispatch calls for selecting/deselecting tiles are commented out, breaking expected UX behavior.
- **Fix:** Uncomment and verify the dispatch calls, or implement alternative selection logic.

### 4.7 Nearest City Not Actually Calculated (BuildingPanel.tsx)
- **File:** `src/components/UI/BuildingPanel.tsx` ~line 26
- **Issue:** Always uses `cities[0]` regardless of player position. Should calculate actual nearest city by distance.
- **Fix:** Implement distance calculation to find the actual nearest city.

### 4.8 Inconsistent Activity Event Limits (gameSlice.ts)
- **File:** `src/store/gameSlice.ts` ~lines 438, 948, 1020
- **Issue:** Activity events array is trimmed to different limits in different reducers (100, 50, 50). This creates inconsistent history lengths.
- **Fix:** Use a single constant for the max event limit.

### 4.9 Item Special Effects Not Enforced (harvestData.ts)
- **File:** `src/data/harvestData.ts` ~lines 122-212
- **Issue:** Items define special effects in their descriptions (boat "destroys on storm", climbing gear "player cannot leave mountain") but no game logic enforces these mechanics.
- **Fix:** Implement enforcement logic for each special item effect, or mark effects as "planned" in the data.

### 4.10 Item Quantity Limits Not Enforced (harvestData.ts)
- **File:** `src/data/harvestData.ts` ~line 381
- **Issue:** Each item has a `quantity` field ("Total available in game") but this limit is never checked during harvesting/crafting.
- **Fix:** Track global item counts and enforce quantity limits.

### 4.11 RoundPhaseOverlay Variable Scope Issues
- **File:** `src/components/UI/RoundPhaseOverlay.tsx` ~lines 232-293
- **Issue:** Variables declared inside case blocks without proper block scoping could cause ReferenceErrors or cross-case leakage.
- **Fix:** Wrap each case in explicit block scope `{ }` and ensure variables are properly contained.

### 4.12 Invalid Tailwind Class (BoltLogo.tsx)
- **File:** `src/components/UI/BoltLogo.tsx` ~line 10
- **Issue:** `hover:scale-205` is not a valid Tailwind class. No hover effect is applied.
- **Fix:** Use `hover:scale-110` or add custom scale value to Tailwind config.

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

# Improvements — Deferred Features & Planned Work

## Overview

Full audit of deferred, stubbed, and unimplemented features across the Heroes & Kingdoms codebase. This document catalogs every planned feature, incomplete mechanic, and dead code area identified after the initial bug-fix phases were completed. Items are organized by category with clear descriptions of current state and expected behavior.

---

## Category C: Critical / Dead Code

### C1 — GameHUD.tsx Is Dead Code
**File:** `src/components/UI/GameHUD.tsx`
**Priority:** HIGH

The `GameHUD` component is wired to a city-building game architecture that no longer exists. It attempts to read `state.game.resources`, `state.game.population`, `state.game.resourceStorage`, `state.game.currentTurn`, `state.game.actionPoints`, `state.game.showFogOfWar`, and `state.game.buildingEffects` — none of which exist in the current Redux slices. It also dispatches `nextTurn()`, `toggleFogOfWar()`, and `updateBuildingSystem()` which are not exported from any slice.

The active HUD is `PartyGameHUD.tsx`. GameHUD.tsx is either removed or rewritten to match the real game state.

**Expected resolution:** Remove `GameHUD.tsx` entirely, or replace with a correctly wired component.

---

## Category M: Game Mechanics

### M1 — Bartering / Trading Phase
**Files:** `src/store/gameSlice.ts`, `src/components/UI/RoundPhaseOverlay.tsx`
**Priority:** HIGH

The bartering phase is fully scheduled in the phase rotation (30-second duration) and displays "Trade negotiations and resource exchanges" in the overlay. However, there is no implementation behind it:
- No `case 'bartering':` handler in `updatePhaseTimer` reducer
- No trade proposal or acceptance system
- No player-to-player resource exchange logic
- No trade history tracking
- No trade UI

**Expected behavior:** During the bartering phase, players should be able to propose trades (offer X resources for Y resources), accept or reject incoming proposals, and have exchanges atomically applied to both parties' inventories.

---

### M2 — Combat System
**Files:** N/A (not started)
**Priority:** HIGH

No PvP combat mechanics exist anywhere in the codebase. README documents this as "missing entirely". The game has players co-existing on the same tiles with no conflict resolution.

**Expected behavior:** Players sharing a tile (or an adjacent tile) should be able to initiate combat. Combat requires damage calculation, turn order, and a resolution outcome (elimination or retreat). Hero stats (attack, defense) should factor into combat.

---

### M3 — Victory Conditions
**Files:** `src/store/gameSlice.ts`
**Priority:** MEDIUM

Victory conditions are partially scaffolded. Elimination of other players exists (`removeEliminatedPlayers`), but no win-state detection fires when only one player (or one team) remains. No victory screen or end-game flow exists.

**Expected behavior:** When all players except one (or one team) are eliminated, the game should transition to a victory state, announce the winner, display a results screen, and offer a rematch or lobby return.

---

### M4 — Plains HP Gain Per Round
**Files:** `src/data/gameData.ts`, `src/store/gameSlice.ts`
**Priority:** LOW

Plains terrain has `hpGainPerRound` defined in the terrain data. The terrain processing logic in `gameSlice.ts` applies HP loss from hazardous terrain and item protection, but never reads or applies `hpGainPerRound`.

**Expected behavior:** Players standing on plains tiles at end-of-round should receive the defined HP regeneration amount.

---

## Category I: Item System

### I1 — Terraform Item Effect
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** MEDIUM

Item defined with effect "Make 3 tiles active (can be harvested)". The `consumeItemUse()` reducer decrements uses but never reads the item's effect type. No game logic activates tiles when this item is used.

**Expected behavior:** When a player uses the Terraform item, 3 currently inactive tiles of the player's choosing (or random nearest tiles) become active and harvestable.

---

### I2 — Leech Item Effect
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** MEDIUM

Item defined with effect "Make 2 tiles inactive". Same stub situation as Terraform — effect string exists in data but no game logic reads or applies it.

**Expected behavior:** When a player uses the Leech item, 2 active tiles (chosen or targeted) become inactive and no longer harvestable until reactivated.

---

### I3 — Armageddon Item Effect
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** MEDIUM

Item defined with effect "Deal 2 damage to all players". No damage-all-players logic exists anywhere in the codebase.

**Expected behavior:** When a player uses the Armageddon item, every other player in the game takes 2 HP of damage. Activity log should record the event for each affected player.

---

### I4 — Rejuvenate Item Effect
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** MEDIUM

Item defined with effect "Heal +3 HP". No healing logic is wired to item use.

**Expected behavior:** When a player uses the Rejuvenate item, their HP increases by 3 (capped at max HP).

---

### I5 — Boat Storm Destruction
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** MEDIUM

Boat item data says "If it breaks due to storm, player dies". The disaster system fires storms but never checks whether a player on a water tile has a boat, and never destroys the boat or eliminates the player.

**Expected behavior:** When a storm disaster hits a water tile with a player who has a boat with 0 remaining uses, the boat is destroyed and the player is eliminated. If the player has a boat with uses remaining, one use is consumed instead.

---

### I6 — Climbing Gear Terrain Lock
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** MEDIUM

Climbing gear data says "If no uses left, player cannot leave the mountain". The movement system never checks climbing gear use count before allowing a player to move off a mountain tile.

**Expected behavior:** Before a player can move from a mountain tile to an adjacent tile, the system checks if they have climbing gear with remaining uses. If they have no gear (or depleted gear), the move is blocked. If gear is available, a use is consumed on exit.

---

### I7 — Global Item Quantity Tracking
**Files:** `src/data/harvestData.ts`, `src/store/gameSlice.ts`
**Priority:** LOW

Each item definition includes a `quantity` field representing total availability in the game. Currently nothing enforces this — multiple players can harvest the same limited item an unlimited number of times.

**Expected behavior:** A global counter per item ID tracks how many total copies have been distributed across all players. When the global count reaches the item's `quantity` limit, it becomes unavailable from harvest pools.

---

## Category H: Hero System

### H1 — Hero State Missing from Redux
**Files:** `src/components/UI/HeroPanel.tsx`, `src/components/UI/GameHUD.tsx`, `src/store/gameSlice.ts`
**Priority:** HIGH (blocks H2–H10)

`HeroPanel.tsx` imports `selectHero` from `gameSlice` (not exported). Both `HeroPanel` and `GameHUD` attempt to read `state.game.heroes` and `state.game.selectedHero` which don't exist in the slice's initial state or reducers.

**Expected behavior:** The game slice (or a dedicated `heroSlice`) should include a `heroes` array, a `selectedHero` field, and a `selectHero` reducer. Heroes should be associated with players.

---

### H2 — "View Army" Button Has No Handler
**File:** `src/components/UI/HeroPanel.tsx:122`
**Priority:** MEDIUM (blocked by H1)

Button is rendered but has no `onClick` handler. Clicking it does nothing.

**Expected behavior:** Opens an army management panel showing the units accompanying the selected hero.

---

### H3 — "Skills" Button Has No Handler
**File:** `src/components/UI/HeroPanel.tsx:125`
**Priority:** MEDIUM (blocked by H1)

Button is rendered but has no `onClick` handler.

**Expected behavior:** Opens a skills/abilities panel for the selected hero showing learned skills and available skill points.

---

### H4 — "Cast Spell" Button Has No Handler
**File:** `src/components/UI/HeroPanel.tsx:140`
**Priority:** MEDIUM (blocked by H1, H9)

Button is rendered but has no `onClick` handler.

**Expected behavior:** Opens a spell selection panel showing spells the hero knows and allows targeting for casting.

---

### H5 — "Rest" Button Has No Handler
**File:** `src/components/UI/HeroPanel.tsx:144`
**Priority:** MEDIUM (blocked by H1)

Button is rendered but has no `onClick` handler.

**Expected behavior:** Hero rests, consuming the remaining action points for the turn but recovering a set amount of HP or mana.

---

### H6 — Hero Recruitment System
**Files:** N/A (not started)
**Priority:** HIGH (blocks H2–H10)

No mechanism exists for players to recruit or assign heroes. Heroes are not connected to players in any way.

**Expected behavior:** Players should be able to recruit heroes from a town or starting location. Each player can have a limited number of active heroes.

---

### H7 — Hero Movement Mechanics
**Files:** N/A (not started)
**Priority:** HIGH (blocked by H1, H6)

Heroes are not part of the hex grid movement system. They exist only as a UI stub.

**Expected behavior:** Heroes should occupy hex tiles, consume action points to move, and be subject to the same terrain movement costs as players.

---

### H8 — Hero Leveling & XP System
**File:** `src/components/UI/HeroPanel.tsx`
**Priority:** MEDIUM (blocked by H1, H6)

All stats (Attack: 8, Defense: 6, Spell Power: 4, Knowledge: 3) are hardcoded in the UI with no backing data or leveling logic.

**Expected behavior:** Heroes gain XP from combat and exploration. At level thresholds, stats increase and skill points are awarded.

---

### H9 — Spell Casting System
**Files:** N/A (not started)
**Priority:** LOW (blocked by H1, H6, H8)

No spells are defined anywhere in the codebase. No spell execution, targeting, or effect logic exists.

**Expected behavior:** A `spellsData.ts` defines available spells with mana cost, target type, and effects. Heroes with sufficient Spell Power and mana can cast spells during their turn.

---

### H10 — Army Unit Management
**Files:** N/A (not started)
**Priority:** LOW (blocked by H1, H6)

No unit data structures, recruitment, or army management mechanics exist.

**Expected behavior:** Players recruit units at towns and assign them to heroes. Units have stats that contribute to combat outcomes.

---

## Category B: Building System

### B1 — Building System Mechanics
**Files:** `src/components/UI/BuildingGuide.tsx`, `src/data/buildingsData.ts`
**Priority:** LOW

The `BuildingGuide` modal displays building data correctly, but no building placement, construction queue, or effect application exists in the current game architecture. This feature was part of an earlier city-building design and was not ported to the current party-based hex grid game.

**Expected behavior:** Determine whether buildings are part of the game design. If yes: implement tile-based building placement, construction costs, and stat/resource effects. If no: remove `buildingsData.ts` and `BuildingGuide.tsx`.

---

## Category P: Multiplayer & Infrastructure

### P1 — Real-Time Multiplayer (WebSocket / Supabase Realtime)
**Files:** N/A (not started)
**Priority:** HIGH

All game state is local only. Multiple players can join via the lobby but there is no state synchronization between clients. Each client runs its own independent game state.

**Expected behavior:** Game state (tiles, players, phase timer, activity log) should be synchronized across all connected clients in real time using Supabase Realtime or WebSockets.

---

### P2 — Server-Side Game Session Persistence
**Files:** N/A (not started)
**Priority:** HIGH (blocked by P1)

No game sessions, turn history, or player data is persisted anywhere. Refreshing the page loses all progress.

**Expected behavior:** Game sessions are stored in Supabase. Players can reconnect to an in-progress game. Session history (turns, events) is queryable.

---

### P3 — Player Authentication
**Files:** N/A (not started)
**Priority:** MEDIUM (blocked by P1)

Players are identified only by name string within a session. There is no persistent identity, account system, or authentication.

**Expected behavior:** Players authenticate via Supabase Auth (email/password). Player identity persists across sessions. Stats and game history are tied to the authenticated account.

---

## Dependency Map

```
P1 (Realtime) ─── P2 (Persistence) ─── P3 (Auth)

H1 (Hero State) ─┬── H2 (View Army)
                 ├── H3 (Skills)
                 ├── H4 (Cast Spell) ─── H9 (Spells)
                 ├── H5 (Rest)
                 └── H6 (Recruitment) ─┬── H7 (Movement)
                                        ├── H8 (Leveling)
                                        └── H10 (Army)

M2 (Combat) requires H1, H6, H7, H8 for hero-based combat
```

---

## Summary Table

| ID | Feature | Category | Priority | Status |
|----|---------|----------|----------|--------|
| C1 | GameHUD dead code | Dead Code | HIGH | OPEN |
| M1 | Bartering/trading phase | Mechanics | HIGH | OPEN |
| M2 | Combat system | Mechanics | HIGH | OPEN |
| M3 | Victory conditions | Mechanics | MEDIUM | OPEN |
| M4 | Plains HP gain per round | Mechanics | LOW | OPEN |
| I1 | Terraform item effect | Items | MEDIUM | OPEN |
| I2 | Leech item effect | Items | MEDIUM | OPEN |
| I3 | Armageddon item effect | Items | MEDIUM | OPEN |
| I4 | Rejuvenate item effect | Items | MEDIUM | OPEN |
| I5 | Boat storm destruction | Items | MEDIUM | OPEN |
| I6 | Climbing gear terrain lock | Items | MEDIUM | OPEN |
| I7 | Global item quantity limits | Items | LOW | OPEN |
| H1 | Hero state in Redux | Heroes | HIGH | OPEN |
| H2 | View Army button | Heroes | MEDIUM | OPEN |
| H3 | Skills button | Heroes | MEDIUM | OPEN |
| H4 | Cast Spell button | Heroes | MEDIUM | OPEN |
| H5 | Rest button | Heroes | MEDIUM | OPEN |
| H6 | Hero recruitment system | Heroes | HIGH | OPEN |
| H7 | Hero movement mechanics | Heroes | HIGH | OPEN |
| H8 | Hero leveling/XP | Heroes | MEDIUM | OPEN |
| H9 | Spell casting system | Heroes | LOW | OPEN |
| H10 | Army unit management | Heroes | LOW | OPEN |
| B1 | Building system mechanics | Buildings | LOW | OPEN |
| P1 | Real-time multiplayer | Infrastructure | HIGH | OPEN |
| P2 | Game session persistence | Infrastructure | HIGH | OPEN |
| P3 | Player authentication | Infrastructure | MEDIUM | OPEN |

**Total deferred features: 26**

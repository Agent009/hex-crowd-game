# HEX Crowd Game — Implementation Status

HEX Crowd Game is a Vite/React/TypeScript Phaser board game with Redux Toolkit state, Supabase Auth/Realtime multiplayer, Playwright browser coverage, Vitest domain tests, Tailwind UI, and optional Supabase Edge Function support for realtime diagnostics and session authority.

This document tracks the **product/app build** by **epic -> feature -> status**. See [ProductionReadiness.md](ProductionReadiness.md) for release gates, live Supabase setup, operational checklists, and deployment decisions. This repository currently has no `docs/MarketingImplementationStatus.md`, `docs/guides/GuideIndex.md`, or public marketing source of truth; those surfaces should be created only when the project intentionally adds public/user-guide documentation. The local delivery log is kept in [docs/local/WorkLog.md](docs/local/WorkLog.md).

---

_Last updated: 2026-06-17 — Restructured implementation status to the delivery-documentation workflow format._

---

## Standing rules

1. Any change that adds, removes, or reshapes a user-facing feature must update this file and, when the relevant surfaces exist, the matching guide in `docs/guides/` plus `GuideIndex.md`, public/marketing content, `docs/MarketingImplementationStatus.md`, and `docs/local/WorkLog.md`.
2. **Security audit round (every 5 tranches).** After every 5 feature tranches, run a security + QA audit and record it in `docs/local/SecurityAudit.md`. Fix Critical/High findings before further feature work.
3. **Documentation pruning round (every 10 iterations).** After every 10 feature iterations, prune `ImplementationStatus.md` and any marketing status document to deduplicate overlapping content, streamline wording, optimise readability, and realign structure to the delivery-documentation workflow.
4. Do not mark live Supabase, deployment, accessibility, Lighthouse, soak, or audit gates complete unless they have actually been run in the current target environment.

## Status keys

| Status         | Meaning                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| ⬜ Pending      | Not started                                                                                     |
| 🟨 In progress | Started and actively being built                                                                |
| 🟪 Partial     | Some parts are complete, but the feature is not fully usable or documented                      |
| 🟦 Blocked     | Cannot continue until a dependency, decision, credential, design, or external issue is resolved |
| ✅ Complete     | Implemented, checked, documented, and ready for use                                             |
| 🧊 Deferred    | Intentionally postponed                                                                         |

---

## Overall status

| Area                                      | Status      | Notes                                                                                                                                       |
| ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Core gameplay loop                        | ✅ Complete | Round/phase loop, 91-tile hex board, terrain, disasters, resources, items, crafting, trading, hero/army/combat actions, victory flow.       |
| Game UI and Phaser rendering             | ✅ Complete | Lobby, HUD, action menus, activity log, harvest/trade/hero/combat panels, overlays, victory screen, canvas fallback, and rich hex rendering. |
| State architecture and runtime stability  | ✅ Complete | Domain slices, listener middleware, dirty-tile redraws, cleanup fixes, config consolidation, and top-level runtime/canvas recovery.          |
| Multiplayer and session infrastructure    | 🟪 Partial  | Supabase host-authoritative online sessions, action validation, persistence, reconnect, diagnostics, and optional gateway exist; live validation remains. |
| Production readiness and operations       | 🟪 Partial  | Runbook, CI workflow, local E2E/profile gates, Edge Function typechecks, and dependency audit baseline exist; deployment decisions remain.   |
| Feature depth backlog                     | 🟪 Partial  | Enhanced player profiles, achievements, advanced tile ownership/structures, social/tournament modes, and AI play remain planned work.       |
| Documentation, guides, and public surface | 🟪 Partial  | This status and production runbook exist; user guides, marketing status, coverage matrix, and security audit log are not yet established.    |

---

## Core Gameplay and Player Experience ✅ Complete

The game has a playable local strategy loop with round phases, terrain, resource collection, crafting, bartering, heroes, combat, and win detection.

### Feature status

| # | Feature                         | Status      | Notes                                                                                         |
| - | ------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| 0 | Round, phase, and board loop     | ✅ Complete | Seven-phase gameplay on a 91-tile hex grid with terrain costs/effects and phase overlays.     |
| 1 | Player/team management           | ✅ Complete | Supports 30 players across 10 teams of 3, with balanced allocation coverage.                  |
| 2 | Resources, items, and crafting   | ✅ Complete | Harvest grid, item inventory, crafting, item use, and activity feedback are implemented.       |
| 3 | Trading and bartering            | ✅ Complete | Proposal, acceptance/rejection, validation, history, and realtime routing are implemented.     |
| 4 | Hero, army, spell, and combat    | ✅ Complete | Recruitment, rest, skills, spells, units, adjacent combat, XP, and combat reports are live.   |
| 5 | Victory and reset flow           | ✅ Complete | Solo/team winner detection, victory overlay, final stats, reset, and play-again flow exist.   |
| 6 | Advanced player and tile systems | ⬜ Pending   | Achievements, profiles, connection history, tile ownership, structures, and trade routes remain future depth. |

### Playable Round, Resource, Trade, Hero, and Combat Loop ✅ Complete

**Goal:**

- Provide a complete local tabletop-style strategy loop that can also be driven through the multiplayer host route.

**Done:**

- Implemented the core round lifecycle with seven gameplay phases.
- Implemented the hex grid, terrain types, movement costs, active tiles, disasters, harvesting, crafting, inventory, and player activity logging.
- Implemented player-to-player bartering with validation and history.
- Added hero command surfaces for recruitment, rest, skill learning, spell casting, unit recruitment, and adjacent combat.
- Added combat results, XP flow, combat reports, victory detection, final statistics, and reset/play-again behaviour.
- Removed legacy building guide/data files where they conflicted with the hero/army/combat direction.

**Pending / next-up:**

- Implement deeper item effect rules such as boat storm destruction, climbing gear terrain locks, and global item quantity limits if the design still needs them.
- Add player profiles, achievements, game history, preferences, and richer connection-state presentation.
- Add advanced tile ownership, structures, combat modifiers, trade routes, and historical tile events if they remain in scope.

**Implementation notes:**

- Local and online paths share the same domain actions where possible.
- Historical building/city work is intentionally deferred or removed while the project follows the hero/army/combat direction.

**Documentation status:**

- User guide: Pending; `docs/guides/` does not exist yet.
- Marketing/public content: Not required for this documentation-only update.
- Coverage matrix: Pending; `docs/MarketingImplementationStatus.md` does not exist yet.

---

## Game UI, Rendering, and Runtime Stability ✅ Complete

The UI and Phaser surface have been hardened for ordinary local play, rendering failures, and richer board readability.

### Feature status

| # | Feature                         | Status      | Notes                                                                                         |
| - | ------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| 0 | Lobby and game HUD               | ✅ Complete | Game lobby, HUD, harvest grid, tile info, action menu, combat modal, and overlays exist.      |
| 1 | Material-rich Phaser board       | ✅ Complete | Terrain gradients, rims, grain, glints, hatching, badges, hero rings, contours, and accents.  |
| 2 | Canvas failure recovery          | ✅ Complete | Lazy canvas loading, retry fallback, and top-level error boundary avoid blank surfaces.        |
| 3 | Dirty redraw and cleanup         | ✅ Complete | Dirty-tile rendering, resize handling, lifecycle cleanup, and object lifecycle fixes exist.    |
| 4 | Accessibility and mobile polish  | 🟪 Partial  | Inline validation replaces alerts; broader keyboard, screen-reader, mobile, and contrast checks remain. |

### Phaser Rendering and UI Resilience ✅ Complete

**Goal:**

- Make the board readable, performant enough for the current map/player size, and resilient when runtime or canvas loading fails.

**Done:**

- Added richer hex visuals with stronger contrast, terrain detail, hover/selection treatment, team player badges, and hero markers.
- Added material terrain details including lake glints, river banks/highlights, mountain lines, desert texture, plains tufts, and forest canopy detail.
- Added contour rings and terrain-coloured edge accents while keeping rendering inside the existing dirty-tile lifecycle.
- Lazy-loaded the Phaser canvas chunk and added a retryable canvas fallback.
- Added a top-level accessible error boundary with try-again/reload recovery.
- Replaced alert-based harvest validation with inline panel feedback.
- Fixed historical runtime issues around cursor setup, recursive polling, unsafe tile/player access, texture keys, import paths, Tailwind class names, and stale globals.

**Pending / next-up:**

- Run a dedicated accessibility pass covering keyboard operation, screen-reader labels, colour contrast, and responsive/mobile controls.
- Revisit tile virtualisation only if maps grow substantially beyond the current 91-tile board.

**Implementation notes:**

- `GameConfig.ts` centralises camera, rendering, animation, canvas, and performance settings.
- `GameCanvas` and `GameEngine` own Phaser lifecycle and cleanup rather than leaking through global state.

**Documentation status:**

- User guide: Pending for player controls and screen explanation.
- Marketing/public content: Not required.
- Coverage matrix: Pending.

---

## Multiplayer, Persistence, and Trust Boundaries 🟪 Partial

Online play uses Supabase Auth/Realtime with host-authoritative sessions. The browser host still owns gameplay simulation, so production anti-cheat remains a product/architecture decision.

### Feature status

| # | Feature                                 | Status      | Notes                                                                                              |
| - | --------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| 0 | Supabase auth and realtime sessions      | ✅ Complete | Auth service, session codes, channels, presence, session persistence, and reconnect paths exist.    |
| 1 | Host-routed action pipeline              | ✅ Complete | Movement, harvesting, crafting, items, trades, heroes, spells, combat, and phase control route through host authority online. |
| 2 | Local action ownership checks            | ✅ Complete | Clients refuse to emit player-owned realtime actions for a different local player ID.              |
| 3 | Host validation and authorization        | ✅ Complete | Host-side validation, host-control authorization, negative-resource trade rejection, and rate limiting exist. |
| 4 | State sync and host migration hardening  | ✅ Complete | Session-scoped, sequenced, deduplicated state sync and session-scoped host migration validation exist. |
| 5 | Persistence, reconnect, and diagnostics  | ✅ Complete | Persisted-state validation, active-session validity, diagnostics, audit logging, and optional diagnostics sink exist. |
| 6 | Session authority gateway                | 🟪 Partial  | Edge Function and RLS/data-integrity migrations exist; deployment and production validation remain. |
| 7 | Fully server-authoritative simulation    | ⬜ Pending   | Required only if gameplay actions must be owned by infrastructure rather than the current host client. |

### Host-Authoritative Supabase Multiplayer 🟪 Partial

**Goal:**

- Support online games with clear host authority, bounded client trust, reconnect behaviour, persistence, diagnostics, and a path toward stronger server ownership.

**Done:**

- Added Supabase-backed online session creation, join/reconnect, presence, host migration, persistence, and action audit logging.
- Added local player ID preservation on join to prevent multiplayer player identity drift.
- Added client-side local action ownership checks before broadcast or host-local dispatch.
- Added host-side action validation before dispatch, state sync, and audit logging.
- Added host-control authorization for start, force-next-phase, and end-game actions.
- Added per-actor and per-session host action-rate limiting with realtime diagnostics.
- Added client-side state-sync validation for malformed, stale, wrong-session, and invalid world/game snapshots.
- Added persisted-state restore validation for in-progress joins and reconnects.
- Added state-sync payload byte measurement and throttled oversized-payload diagnostics.
- Added a disconnect grace window so transient presence leaves do not immediately remove players or migrate host.
- Added optional `session-authority` and `realtime-diagnostics` Supabase Edge Functions, plus migrations for diagnostics, data-integrity checks, and authority-gateway behaviour.

**Pending / next-up:**

- Configure Supabase test-project secrets and run the gated live create/join/ready/start/reconnect/persisted-state Playwright harness.
- Deploy and validate the optional `session-authority` gateway against a Supabase test project.
- Decide whether production gameplay can remain client-host-authoritative or needs a dedicated server/Edge simulation layer.
- Decide whether the included realtime diagnostics Edge Function is the final sink or a forwarding layer to another monitoring platform.

**Implementation notes:**

- Supabase is the current backend for both auth and the core realtime/session/persistence path, not just login.
- Replacing auth is a smaller project than replacing Supabase entirely because realtime transport, presence, session storage, state persistence, migrations, Edge Functions, and diagnostics would also need replacement.

**Documentation status:**

- User guide: Pending for creating, joining, reconnecting, and troubleshooting online sessions.
- Marketing/public content: Not required.
- Coverage matrix: Pending.

---

## Production Readiness, QA, and Operations 🟪 Partial

The repo has strong local gates and a production runbook, but live Supabase validation and deployment choices remain open.

### Feature status

| # | Feature                            | Status      | Notes                                                                                         |
| - | ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| 0 | Production readiness runbook        | ✅ Complete | `ProductionReadiness.md` covers release gates, live E2E, soak, Supabase, env, observability, and dependency policy. |
| 1 | Local type/lint/unit gate           | ✅ Complete | `npm run check` baseline previously passed with 5 Vitest files / 53 tests.                    |
| 2 | Local build gate                    | ✅ Complete | `npm run build` previously passed with split Phaser, Supabase, React, icon, vendor, and app chunks. |
| 3 | Local Playwright and soak coverage  | ✅ Complete | Local smoke/profile and 60-second 30-player soak previously passed; live test skipped without env. |
| 4 | Edge Function typecheck             | ✅ Complete | `npm run check:edge` previously passed through the npm Deno shim.                              |
| 5 | Dependency audit baseline           | ✅ Complete | `npm audit --audit-level=moderate` previously passed with 0 vulnerabilities.                  |
| 6 | Live Supabase production-like gate  | 🟪 Partial  | Harness exists, but configured test-project run remains pending.                              |
| 7 | Recurring security audit log        | ⬜ Pending   | `docs/local/SecurityAudit.md` has not been created or populated.                              |

### Release Gates and Operational Decisions 🟪 Partial

**Goal:**

- Keep release readiness tied to repeatable checks, explicit environment setup, and honest pending deployment decisions.

**Done:**

- Added `.github/workflows/ci.yml` for install, typecheck/lint/unit, production build, Edge Function typecheck, audit, default Playwright E2E, scheduled/manual long-soak, and manual live Supabase smoke.
- Added `ProductionReadiness.md` with local release gates, live Supabase E2E setup, long-soak profile, Supabase checklist, environment checklist, observability, session authority gateway, dependency policy, and remaining production decisions.
- Added Playwright browser-runtime profiling for a 30-player local game with startup timing, frame sampling, optional heap checks, screenshot capture, PNG pixel-richness assertions, and console-error checks.
- Added local-game Playwright smoke coverage for lobby start, running HUD, hero command presence, Phaser canvas mount/sizing, screenshot capture, and PNG pixel-richness assertions.
- Added gated live Supabase smoke coverage for host/guest create-join-ready-start-persist-reconnect-canvas flow.
- Added an opt-in 30-player long-soak profile.
- Cleared previous production dependency audit findings with safe updates and a targeted `brace-expansion` override.
- Completed the Vite 8 tooling migration and removed stale unused runtime dependencies.

**Pending / next-up:**

- Run live Supabase E2E against a disposable test project with `LIVE_SUPABASE_E2E=1`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- Configure `SUPABASE_E2E_URL` and `SUPABASE_E2E_ANON_KEY` repository secrets before relying on the manual live Supabase workflow.
- Review scheduled/manual long-soak CI results and tune threshold/cadence.
- Finalise Supabase Auth, Realtime, RLS, retention, cleanup, and anonymous-access policy for the chosen deployment model.
- Create and run the first recurring `docs/local/SecurityAudit.md` round before the fifth future feature tranche.

**Implementation notes:**

- Current verification evidence comes from the 2026-06-10 production-readiness tranche and `ProductionReadiness.md`; it should be refreshed when the next feature or release candidate changes code.
- Do not treat skipped live Supabase tests as production validation.

**Documentation status:**

- User guide: Pending.
- Marketing/public content: Not required.
- Coverage matrix: Pending.

---

## Documentation, Guides, and Public Surface 🟪 Partial

The implementation status has now been realigned with the delivery-documentation workflow. Other documentation surfaces are intentionally recorded as absent until the project needs them.

### Feature status

| # | Documentation surface                  | Status      | Notes                                                                                         |
| - | -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| 0 | Root implementation status              | ✅ Complete | This file now follows the epic -> feature -> status structure.                                |
| 1 | Production readiness runbook            | ✅ Complete | Release gates and operational setup are tracked in `ProductionReadiness.md`.                  |
| 2 | Local work log                          | ✅ Complete | `docs/local/WorkLog.md` now records this documentation maintenance task.                      |
| 3 | User guide index and feature guides     | ⬜ Pending   | `docs/guides/GuideIndex.md` and feature guides do not exist yet.                              |
| 4 | Marketing/public status and matrix      | ⬜ Pending   | `docs/MarketingImplementationStatus.md` does not exist; no public marketing surface was changed. |
| 5 | Recurring security/QA audit log         | ⬜ Pending   | `docs/local/SecurityAudit.md` does not exist yet.                                             |

### Documentation Workflow Alignment ✅ Complete

**Goal:**

- Make the implementation status useful for future agents by showing current epics, feature status, pending work, and the next continuation prompt without relying on old chronological audit blocks.

**Done:**

- Replaced the historical phase/audit list with workflow-aligned overall status, semantic epics, feature status tables, done/pending sections, implementation notes, and documentation status.
- Preserved concrete completion evidence from the production-readiness tranche.
- Preserved remaining hardening around live Supabase validation, session authority deployment, diagnostics sink choice, and possible server-authoritative simulation.
- Added a local work log entry for this documentation task.

**Pending / next-up:**

- Create `docs/guides/GuideIndex.md` and player/operator guides when the project begins formal user documentation.
- Create `docs/MarketingImplementationStatus.md` only if the project adds a public marketing/help surface or wants a public coverage matrix.
- Create `docs/local/SecurityAudit.md` and run a recurring audit round at the next cadence boundary or before production release.

**Implementation notes:**

- This repo currently keeps `ImplementationStatus.md` at the repository root, not under `docs/`.
- Documentation links in the standing rules should continue to reflect actual files rather than assuming Next.js-style public docs exist.

**Documentation status:**

- User guide: Pending.
- Marketing/public content: Not required for this task.
- Coverage matrix: Pending.

---

## Future Feature Depth 🟪 Partial

These items are product-expansion opportunities rather than blockers for the current local multiplayer-ready build.

### Feature status

| # | Feature area                      | Status    | Notes                                                                                   |
| - | --------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| 0 | Enhanced player model             | ⬜ Pending | Combat stats, achievements, game history, preferences, and connection status.           |
| 1 | Enhanced session management        | 🟪 Partial | Supabase sessions exist; richer game settings, winner records, and history remain.      |
| 2 | Advanced tile system               | ⬜ Pending | Ownership, structures, combat modifiers, trade routes, and historical events.           |
| 3 | Mobile and accessibility upgrades  | ⬜ Pending | Touch controls, responsive tablet layouts, screen-reader support, colour-blind palette, and UI scaling. |
| 4 | Social and competitive modes       | ⬜ Pending | Friends, private rooms, tournaments, leagues, and spectator mode.                       |
| 5 | AI and balancing support           | ⬜ Pending | AI players, intelligent balancing, and predictive behaviour analysis.                   |

---

## Security, QA, and Hardening Backlog

| Item | Status | Priority | Notes |
| ---- | ------ | -------- | ----- |
| Live Supabase E2E run | ⬜ Pending | High | Required before claiming online multiplayer production readiness. |
| Session authority gateway deployment | ⬜ Pending | High | Deploy and validate against a Supabase test project before relying on service-owned persistence/audit writes. |
| Server-authoritative gameplay decision | ⬜ Pending | High | Decide whether current host-authoritative trust is acceptable for the intended production mode. |
| Diagnostics sink decision | ⬜ Pending | Medium | Decide whether Supabase Edge Function storage is final or should forward to Sentry/OpenTelemetry/admin API. |
| Supabase RLS/retention/cleanup policy | ⬜ Pending | High | Finalise before production-like deployment. |
| Accessibility pass | ⬜ Pending | Medium | Keyboard, screen-reader, colour contrast, responsive/mobile controls, and UI scaling checks remain. |
| Recurring security audit log | ⬜ Pending | Medium | Create `docs/local/SecurityAudit.md` and record the first audit round when due or before production release. |

---

## Next prompt to continue building

**Tranche 2 — Live Supabase validation and production trust decision**

Continue from the current implementation status.

Completed so far:

- Core gameplay, UI, Phaser rendering, local state architecture, host-authoritative Supabase multiplayer, reconnect/persistence validation, diagnostics, optional session authority gateway code, production runbook, local verification gates, and CI workflow are in place.
- Local verification from the previous production-readiness tranche included `npm run check`, `npm run build`, `npm run check:edge`, `npm run test:e2e`, a 60-second local soak run, and dependency audit. Live Supabase online E2E skipped without configured env.
- `ImplementationStatus.md` has been restructured to the delivery-documentation workflow format, and `docs/local/WorkLog.md` now records local documentation work.

Next build target:

- Configure a disposable Supabase test project, apply the listed migrations, enable Realtime, set live E2E env/secrets, and run the gated create/join/ready/start/persist/reconnect Playwright harness.
- Deploy and validate `supabase/functions/session-authority` and confirm gateway-created sessions reject direct anonymous persistence/audit writes.
- Decide whether production gameplay remains client-host-authoritative or moves to a dedicated server/Edge simulation layer.
- Record results in `ImplementationStatus.md`, `ProductionReadiness.md`, `docs/local/WorkLog.md`, and create `docs/local/SecurityAudit.md` if a security/QA gate is run.

Use the relevant project instructions and skills:

- Follow repository instructions and inspect current code before changing behaviour.
- Use the delivery-documentation workflow for status, work-log, guide/public-surface decisions, and final reporting.
- Keep verification honest: do not mark live Supabase, Edge Function, accessibility, soak, audit, or deployment gates complete unless they were actually run.

Prompt:

> Continue HEX Crowd Game production readiness from the current `ImplementationStatus.md`. First inspect `ProductionReadiness.md`, `src/services/RealtimeService.ts`, Supabase migrations/functions, Playwright E2E specs, and the current work log. Then configure or document the disposable Supabase live E2E path, run the gated live online smoke where credentials are available, validate the optional `session-authority` gateway, decide whether server-authoritative simulation is required for the intended production trust model, and update `ImplementationStatus.md`, `ProductionReadiness.md`, `docs/local/WorkLog.md`, and any security audit documentation with exact checks run and remaining gaps.

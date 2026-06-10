# HEX Golems Production Readiness

**Last updated:** 2026-06-10

This runbook tracks the operational gates that sit outside the local game loop. The current build is host-authoritative over Supabase Realtime, with local reducer guards, local action ownership checks before client broadcast, host-side action validation, host-control authorization, per-actor and per-session host action-rate limiting, persisted-state restore/status validation, session-scoped ordered/deduplicated client-side host snapshot and host-migration validation, throttled state-sync payload budget diagnostics, a disconnect grace window for transient presence drops, and an optional service-role session authority gateway for production persistence/audit writes. A fully server-authoritative simulation layer is still required if gameplay actions must be owned by infrastructure rather than by the current host client.

## Release Gates

Run these before every production candidate:

```bash
npm run check
npm run build
npm run check:edge
npm run test:e2e
npm audit --audit-level=moderate
```

The default GitHub Actions workflow in `.github/workflows/ci.yml` runs the same gates on pushes to `main`/`master` and on pull requests. The workflow also has a scheduled/manual `30-player long-soak browser profile` job for the heavier soak gate, plus a manual `Live Supabase online multiplayer smoke` job for disposable test-project credentials.

Expected local baseline on 2026-06-10:

- `npm run check`: 5 Vitest files / 53 tests.
- `npm run test:e2e`: 2 local Chromium tests pass with canvas PNG pixel-richness assertions, 1 live Supabase test skips unless live env is configured, and 1 long-soak test skips unless soak env is configured.
- `SOAK_E2E=1 SOAK_E2E_DURATION_MS=60000 npm run test:e2e`: 3 Chromium tests pass locally, including the 30-player long-soak profile; the live Supabase test still skips unless live env is configured.
- `npm run build`: Vite 8 production build with split `phaser`, `supabase`, `react-vendor`, `icons`, `vendor`, `GameCanvas`, and app chunks.
- `npm run check:edge`: Deno typecheck for `realtime-diagnostics` and `session-authority` through the npm Deno shim.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.

## Live Online E2E

The live multiplayer smoke is intentionally gated so normal local/CI runs do not hit a shared database.

Required env:

- `LIVE_SUPABASE_E2E=1`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional local test-mode values from `.env`: `VITE_TEST_MODE=true`, `VITE_REQUIRED_TEAMS=1`, `VITE_REQUIRED_PLAYERS_PER_TEAM=2`

Manual CI dispatch secrets:

- `SUPABASE_E2E_URL`
- `SUPABASE_E2E_ANON_KEY`

Set `run_live_supabase_e2e` when dispatching the workflow manually. The job maps those secrets to the Vite env names and runs the same Playwright suite in test mode.

Command:

```bash
LIVE_SUPABASE_E2E=1 npm run test:e2e
```

The spec creates a host browser context, joins a guest context, readies both players, starts the game, waits for host persistence, reconnects from a fresh context, verifies the Phaser canvas and rendered PNG pixel richness, and best-effort marks the session ended. Run it only against a disposable Supabase test project.

## Long-Soak Browser Profile

The local long-soak profile is also opt-in so regular feedback stays fast.

Required env:

- `SOAK_E2E=1`

Optional env:

- `SOAK_E2E_DURATION_MS=60000` by default, with a minimum of 15000.

Command:

```bash
SOAK_E2E=1 SOAK_E2E_DURATION_MS=60000 npm run test:e2e
```

The spec fills a 30-player local game, starts the Phaser scene, samples animation frames every 5 seconds for the configured duration, enforces frame thresholds, checks optional browser heap data, and fails on browser console errors.

The GitHub Actions workflow runs this profile on the daily schedule and through `workflow_dispatch`. The manual dispatch input `soak_duration_ms` defaults to `60000` and can be raised for release-candidate profiling.

## Supabase Checklist

Before a production-like deployment:

- Apply `supabase/migrations/20260226214905_create_game_sessions.sql`.
- Apply `supabase/migrations/20260226222238_add_game_state_persistence.sql`.
- Apply `supabase/migrations/20260609232000_harden_game_session_integrity.sql`.
- Apply `supabase/migrations/20260609233000_create_realtime_diagnostics.sql`.
- Apply `supabase/migrations/20260610001000_allow_action_rate_limited_diagnostics.sql` when upgrading an environment that already has the diagnostics table.
- Apply `supabase/migrations/20260609235000_add_session_authority_gateway.sql` when deploying the optional session authority gateway.
- Verify `game_sessions` has indexes on `session_code` and `game_mode`.
- Verify `game_sessions` has the cleanup index for ended sessions.
- Verify `game_turn_history` has indexes on `session_id` and `(session_id, round_number)`.
- Verify new session writes enforce session-code, game-mode, player-count, JSON-state, phase, and action-type constraints.
- Verify active-session checks report saved-state validity and in-progress joins/reconnects reject malformed persisted `game_state`/`world_state` before restoring local Redux state.
- Confirm Realtime is enabled for the project and broadcast/presence traffic is allowed.
- Confirm anonymous access policy is intentional for the target environment.
- For ranked or public production play, deploy `supabase/functions/session-authority`, set `VITE_SESSION_AUTHORITY_ENDPOINT`, and verify gateway-created sessions reject direct anonymous session updates, direct turn-history inserts, and host migration claims for players missing from saved session state.
- For stronger anti-cheat than host-owned validation, move gameplay action simulation to a dedicated server/Edge Function instead of only moving persistence and audit writes.
- Configure retention/cleanup for ended sessions and turn history, especially if long playtests generate many state saves.
- Schedule `delete_ended_game_sessions(...)` only after choosing the retention window for the environment.

## Environment Checklist

Required for online play:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Recommended for production-like smoke tests:

- `VITE_TEST_MODE=false` for full 30-player rules.
- `VITE_REQUIRED_TEAMS=10`
- `VITE_REQUIRED_PLAYERS_PER_TEAM=3`
- `VITE_GRID_SYSTEM=topDown` unless an isometric release is explicitly targeted.
- `VITE_PLAYER_DISCONNECT_GRACE_MS=10000` by default; tune after live network profiling.
- `VITE_HOST_ACTION_RATE_LIMIT_MAX_ACTIONS=20` by default; caps accepted host-routed actions per actor inside the rolling host window.
- `VITE_HOST_ACTION_RATE_LIMIT_SESSION_MAX_ACTIONS=60` by default; caps accepted host-routed actions across the whole session inside the same rolling window.
- `VITE_HOST_ACTION_RATE_LIMIT_WINDOW_MS=1000` by default; controls the host-routed action-rate window.
- `VITE_STATE_SYNC_WARN_BYTES=200000` by default; tune after live Supabase payload profiling.
- `VITE_STATE_SYNC_WARN_MIN_INTERVAL_MS=30000` by default; prevents repeated oversized-payload warnings from flooding diagnostics.
- `VITE_SESSION_AUTHORITY_ENDPOINT=https://<project-ref>.functions.supabase.co/session-authority` for server-owned production session persistence/audit writes.

Never commit project secrets. The anon key is expected in browser builds, but service-role keys must not be used by the Vite app.

## Observability

Current runtime diagnostics are held in memory by `RealtimeService.getDiagnostics()`, emitted as a browser `hex:realtime-diagnostic` event, and can be POSTed to `VITE_REALTIME_DIAGNOSTICS_ENDPOINT` when that endpoint is configured. The reference endpoint is `supabase/functions/realtime-diagnostics`.

Deploy the reference sink:

```bash
supabase functions deploy realtime-diagnostics
```

Then set:

```bash
VITE_REALTIME_DIAGNOSTICS_ENDPOINT=https://<project-ref>.functions.supabase.co/realtime-diagnostics
```

Diagnostics include:

- missing realtime channels
- failed action broadcasts
- rejected invalid host actions
- refused local actions for another player ID
- rejected host actions that exceed per-actor or per-session action-rate limits
- rejected malformed state-sync snapshots
- rejected stale/out-of-order or wrong-session state-sync snapshots
- rejected wrong-session host-migration broadcasts
- throttled oversized state-sync payload warnings
- disconnect grace-window expirations
- failed state-sync broadcasts
- persistence save failures
- turn-audit write failures
- player-count update failures
- disconnect update failures

Production follow-up: decide whether to use the included Supabase Edge Function as-is or forward from it to Sentry, OpenTelemetry, or an internal admin API. Include session ID, action type, player ID, round, phase, and reason, but avoid storing full state payloads unless access is restricted.

## Session Authority Gateway

The optional `supabase/functions/session-authority` gateway lets production avoid direct browser updates for host-owned persistence and audit writes. When `VITE_SESSION_AUTHORITY_ENDPOINT` is configured, the app routes these operations through the Edge Function:

- session creation
- host migration authority claim
- host state save
- player-count update
- turn-action audit insert
- mark-session-ended on host disconnect

Deploy the gateway:

```bash
supabase functions deploy session-authority
```

Then set:

```bash
VITE_SESSION_AUTHORITY_ENDPOINT=https://<project-ref>.functions.supabase.co/session-authority
```

The function stores only a SHA-256 hash of the host authority token in `game_sessions`. Sessions created without the gateway keep the direct-write fallback for local/dev use; sessions created through the gateway are protected by the authority-gateway RLS migration. Host migration claims issue a replacement token only when the claimed host player exists in the saved session roster.

## Dependency Policy

- Run `npm audit --audit-level=moderate` before release and after dependency updates.
- Review dependency updates monthly, prioritising Vite, React, Phaser, Supabase, Playwright, Vitest, ESLint, and TypeScript.
- Keep runtime dependencies lean; remove unused packages rather than carrying stale transitive trees.
- For security overrides, document why the override exists and remove it when upstream packages no longer need it.
- Re-run `npm run check`, `npm run build`, and `npm run test:e2e` after any tooling/runtime major upgrade.

## Remaining Production Decisions

- Decide whether the product can remain client-host-authoritative with a server-owned persistence gateway, or requires a dedicated server/Edge Function to own gameplay action simulation.
- Decide whether the included realtime diagnostics Edge Function is the final sink or a forwarding layer.
- Decide whether the session authority Edge Function is sufficient for production persistence/audit ownership or should be folded into a broader game-server API.
- Decide the live Supabase CI strategy, including disposable database lifecycle and test-session cleanup policy.
- Decide CI cadence and duration for the opt-in long-soak browser profile.

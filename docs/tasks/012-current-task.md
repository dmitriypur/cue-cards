# Task 012 — mobile AI cue generation workflow

**Status:** Complete

**Plan source:** Task 12 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Expose whole-script and per-card AI generation in the offline-first mobile workflow while keeping local cue state authoritative, preserving full text and manual cues, and synchronizing completed server results through the existing outbox/change-feed path.

## Acceptance

- Offline generation requests remain locally pending; online requests synchronize the aggregate before starting server generation.
- One poller tracks each active generation, supports cancellation and manual refresh, and triggers ordinary sync at a terminal server state.
- UI covers pending, progress, ready, stale, failed, offline, retry, and unrestricted superadmin messaging without a commercial quota counter.
- Import always saves locally before generation, the editor exposes script/card generation, and manual cue replacement requires explicit confirmation.
- Recording defaults missing/non-ready cue cards to full text while keeping stale/manual cues available by explicit user choice.
- Focused/full mobile tests, strict typecheck, production build, OpenAPI drift, and Android debug verification pass.

## Execution rule

Work through Task 12 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 13.

## Progress

- Confirmed Tasks 001–011 are complete from Git history, task checkpoints, the implementation plan, and the development log.
- Created isolated worktree `.worktrees/codex-task-012-mobile-ai` on branch `codex/task-012-mobile-ai` from clean `main` at `804419c`.
- Baseline mobile verification passed 150 tests in 32 files. The existing Node experimental SQLite warnings remain unchanged.
- Added offline-first script/card generation actions, a generated-contract HTTP gateway, idempotent durable SQLite request recovery across startup/connectivity/app resume, one cancellable 2/5/10-second poll chain per generation, manual refresh, and terminal ordinary sync/change-feed application.
- Added pending/progress/ready/stale/failed/offline UI, safe script/card errors, duplicate-start guards, superadmin unrestricted messaging, import save-first choices, editor script/card controls, and explicit server-enforced confirmation before replacing manual cues.
- Recording now keeps the global display preference while using a per-card full-text fallback for unavailable cues; ready cues return automatically and stale/manual cues require an explicit per-card choice.
- Review findings were closed with tests for durable request phases and operation replay, failure snapshots, cue-versioned manual protection through valid acceptance, whole-script exclusion of manual cards, resumed UI hydration, recording fallback, card-scoped errors, and duplicate polling/paid-start prevention.
- Final verification passed: API 92 tests (91 passed, 1 skipped, 639 assertions) and Pint; mobile 195 tests, strict typecheck, production build, E2E gate, deterministic OpenAPI generation, Capacitor sync, and Android debug unit/assembly (297 tasks).
- Task 012 is complete. Task 013 has not started.

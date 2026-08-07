# Task 009 — idempotent Laravel synchronization

**Status:** Complete

**Plan source:** Task 9 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Accept validated local `script.replace` snapshots through an idempotent, ownership-safe Laravel sync pipeline, expose optimistic conflicts without overwriting either side, and provide a cursor-based per-user change feed.

## Acceptance

- Script snapshots enforce UUID relationships, unique IDs, contiguous card positions, content hashes, valid ready cue sets, and coherent soft deletes inside the domain layer.
- Applying one new operation increments the aggregate version once, persists the snapshot atomically, records the operation, and appends exactly one change-feed entry.
- Retrying the same operation returns its original result without a second write; stale base versions return both local and current server snapshots without modifying rows.
- Sync commands apply in request order and remain scoped to the authenticated owner; API batches, payloads, cursor pages, and rate are bounded.
- Correlation IDs and structured sync logs contain only identifiers, versions, and outcomes—never script text or secrets.
- SQLite and PostgreSQL sync coverage, the full API suite, Pint, OpenAPI generation/drift, and relevant mobile checks pass.

## Execution rule

Work through Task 9 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 10.

## Progress

- Confirmed Tasks 001–008 are complete from Git history, task checkpoints, and the development log.
- Created branch `codex/task-009-sync` from clean `main` at `6fe233c`.
- Added immutable script snapshot/content-hash validation and observed the focused RED before the domain suite reached GREEN.
- Added portable sync operation/change-feed tables plus transactional apply, exact retry idempotency, ordered batches, optimistic conflicts, soft deletes, and cursor reads.
- Added API batch/payload bounds, per-user cursor pagination and throttling, stable conflict responses, correlation IDs, and allowlisted structured sync logs.
- Reproduced nested UUID ownership gaps for cards and cue sets with RED integration tests; both are now rejected before writes, and the focused sync suite passes 25 tests with 138 assertions.
- Review fixes align OpenAPI relationship IDs with server snapshots, convert invalid domain payloads to stable 422 responses, accept the mobile script-delete shape, allow tombstones to retain reused positions, cap cues at 200 Unicode characters, and validate strict RFC 3339 timestamps.
- Reproduced the exact-retry race with two PostgreSQL processes; sync operations now use an atomic insert-or-ignore claim before aggregate persistence.
- Final verification passed on SQLite and PostgreSQL, including the PostgreSQL-only concurrent retry test, full mobile regression checks, deterministic OpenAPI generation, Capacitor sync, and Android debug unit/build gates.

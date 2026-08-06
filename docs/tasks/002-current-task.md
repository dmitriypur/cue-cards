# Task 002 — mobile domain and transactional local storage

**Status:** Complete

**Plan source:** Task 2 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Define the mobile script aggregate and cue-state rules, then persist aggregate snapshots and their sync outbox command atomically in local SQLite.

## Acceptance

- Domain types keep ordered cards, immutable cue arrays, explicit cue/sync states, hashes, versions, and timestamps.
- Changing card text never clears cues and marks mismatched generated cues stale.
- One local transaction saves scripts, cards, cue sets, and a `script.replace` outbox command.
- A failed outbox insert rolls back the complete aggregate write.
- Pending snapshots coalesce without changing operation/base version; an in-flight command gets one successor.
- Native SQLite migrations finish before the router mounts.

## Execution rule

Work through Task 2 only, record RED/GREEN and final verification in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 3.

## Completion evidence

- `cueState` RED failed on the missing module, then passed with hash-aware stale handling and Web Crypto SHA-256.
- `SaveScriptAggregate` RED failed on missing use-case/repository modules, then passed against Node's real in-memory SQLite.
- The integration suite covers two-card round-trip persistence, rollback, pending coalescing, in-flight succession, and recording-cursor preservation.
- The final mobile suite, strict typecheck, production build, Capacitor sync, Android unit tests, and debug APK build all pass.

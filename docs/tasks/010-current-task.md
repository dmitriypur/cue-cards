# Task 010 — mobile outbox synchronization and explicit conflict resolution

**Status:** Complete

**Plan source:** Task 10 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Upload persisted mobile outbox commands in order, apply server changes transactionally, and preserve both snapshots whenever optimistic synchronization reports a conflict.

## Acceptance

- Offline, startup, connectivity, resume, and manual triggers share one non-overlapping `RunSync` action.
- Outbox acknowledgements, aggregate server-version updates, and pending-successor rebases are atomic and survive app restarts.
- Remote pages apply transactionally and advance the persisted cursor only after every change succeeds.
- Automatic retries are bounded; authentication and conflicts require explicit user action.
- Persistent conflicts retain local and server snapshots; the user can accept the server or duplicate the local copy with fresh UUIDv7 identifiers.
- The global banner and conflict view expose offline, syncing, current, retrying, authentication-required, and conflict states.
- Focused/full mobile suites, strict typecheck, production build, Capacitor sync, and Android debug verification pass.

## Execution rule

Work through Task 10 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 11.

## Progress

- Confirmed Tasks 001–009 are complete from Git merges, task checkpoints, and the development log.
- Created isolated worktree branch `codex/task-010-mobile-sync` from clean `main` at `85ba8af`.
- Added one process-wide `RunSync` path for startup, connectivity, resume, and manual triggers; uploads are FIFO and one command per aggregate is in flight at a time.
- Added atomic acknowledgement/successor rebasing, crash recovery, persisted retry metadata, bounded automatic upload/download retries, transactional cursor pages, and hash-safe remote cue application.
- Added OpenAPI-backed `HttpSyncGateway`, Capacitor Network connectivity, persistent conflict migration/repository, explicit server/local-copy resolution, global status banner, and conflict route/view.
- Review-driven RED regressions now preserve edits made both during and after a 409, keep remote edits behind explicit optimistic conflict resolution, serialize every operation on the single SQLite connection, run a queued follow-up pass, preserve FIFO retry order, replace nullable cue placeholders safely, and exclude card tombstones from local copies.
- Successful login and every committed local aggregate save trigger the shared sync action; manual retry bypasses persisted delays, restart restores one deduplicated timer, and obsolete timers are cancelled after success.
- Final API verification passed 64 tests (63 passed, 1 PostgreSQL-only skipped) with 486 assertions; Pint passed.
- Final mobile verification passed 150 tests in 32 files; typecheck, build, E2E, deterministic contract generation at Git object hash `8631ef48065b59bb2a36a3746e66ecadd779cc61`, and Capacitor sync passed.
- Final Android `testDebugUnitTest assembleDebug` passed with 297 actionable tasks (26 executed, 271 up-to-date); the two existing `flatDir` warnings remain unchanged.
- Four independent review passes found no remaining Critical or Important code issue after the regression fixes.
- Installed `system-images;android-34;aosp_atd;arm64-v8a` after the user accepted its SDK license, created AVD `cue_cards_task010_api34`, installed the 24 MB debug APK, and ran the Android offline/online smoke. The same app process remained alive while `navigator.onLine` changed `true -> false -> true`; WebView DOM evidence changed from `Войдите для синхронизации` to `Офлайн — изменения сохранены на устройстве` and back after connectivity was restored.
- Task 010 is complete. Task 011 has not started.

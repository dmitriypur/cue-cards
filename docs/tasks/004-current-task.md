# Task 004 — offline library and local script lifecycle

**Status:** Complete

**Plan source:** Task 4 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Present locally persisted scripts as the offline home screen and support opening, recording, editing, soft deletion, and undo without requiring the API.

## Acceptance

- The library renders empty, populated, cue-status, sync-status, and offline states from local repositories.
- Scripts are sorted by `lastOpenedAt`, then `updatedAt`, descending.
- Record and Edit navigation update `lastOpenedAt` locally before opening the destination.
- Confirmed deletion soft-deletes locally and records the changed aggregate in the outbox atomically.
- Cancelling deletion writes nothing; Undo restores the aggregate while respecting pending versus in-flight outbox semantics.
- Focused tests, the complete mobile suite, strict typecheck, production build, Capacitor sync, and Android debug verification pass.

## Execution rule

Work through Task 4 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 5.

## Completion evidence

- `LibraryView`, library application actions, delete/undo integration, routing, and theme-token suites each failed first on their missing or incorrect behavior and then passed.
- Deletion and Undo persist parent tombstones through `SaveScriptAggregate`; pending commands coalesce, in-flight deletion gets one restored successor, and card tombstones remain unchanged even when timestamps coincide.
- Independent code review found no remaining Critical or Important issues after the tombstone, action-error, summary refresh, connectivity, and contrast fixes.
- The final API suite/Pint, mobile suite, strict typecheck, production build, Capacitor sync, Android unit tests, and debug APK assembly all pass.

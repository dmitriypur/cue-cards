# Task 013 — end-to-end, accessibility, privacy, and failure-path hardening

**Status:** Complete

**Plan source:** Task 13 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Prove the complete synthetic YouTube-script workflow across online/offline transitions, harden recovery and accessibility, and ensure API/mobile diagnostics cannot expose script text or secrets.

## Acceptance

- Deterministic Playwright journeys cover login, import correction, AI cues, editing, recording, offline mutation, reconnect/sync, restart recovery, and explicit conflict duplication.
- Accessibility checks enforce keyboard focus, accessible names, 48×48 targets, 320 px layout, 1.4 font scale, and semantic light/dark contrast.
- API and mobile logging accept only allowlisted safe context and redact script text, passwords, bearer tokens, and AI keys.
- Technical safeguard tests cover login/AI throttling, payload and batch limits, generation timeout, and the three-attempt cap without applying commercial quotas to `superadmin`.
- CI runs contract drift, Playwright, PostgreSQL parity, and Android unit/debug assembly gates.
- Focused and full API/mobile/contract/E2E/Android verification passes and exact evidence is recorded in `docs/DEVELOPMENT_LOG.md`.

## Execution rule

Work through Task 13 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 14.

## Progress

- Confirmed Tasks 001–012 are complete and merged into `main` at `f4cc104` from Git history, checkpoints, the detailed plan, and the development log.
- Created isolated worktree `.worktrees/codex-task-013-hardening` on branch `codex/task-013-hardening` from clean `main`.
- Baseline verification passed API 92 tests (91 passed, 1 PostgreSQL-only skipped), 639 assertions and Pint; mobile 195 tests and strict TypeScript type checking passed.

## Completion evidence

- Deterministic E2E composition uses real application sync actions: offline mutation survives reload, reconnect submits and acknowledges the outbox, 409 recovery records a conflict, and explicit duplication preserves both versions plus a pending local-copy command.
- Accessibility covers representative login/library/import/editor/recording controls at 320 px and 1.4 font scale, 48×48 targets, names/focus, overflow, and every semantic light/dark foreground pair.
- Safe API/mobile contexts validate identifiers, reject secrets hidden under allowlisted names, and sanitize provider failures before queue reporting.
- SQLite API: 98 tests (97 passed, 1 PostgreSQL-only skipped), 678 assertions; Pint passed. PostgreSQL: 98/98, 685 assertions.
- Mobile: 197/197 tests in 39 files; typecheck, build, deterministic OpenAPI generation/drift check, and all 3 Playwright journeys passed.
- Capacitor sync and Gradle `testDebugUnitTest assembleDebug` passed; 297 actionable tasks (26 executed, 271 up-to-date).
- Two independent review passes found no Critical issues; all 10 Important findings were corrected.
- Task 013 is complete. Task 014 has not started.

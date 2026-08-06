# Task 006 — offline recording focus mode

**Status:** Complete

**Plan source:** Task 6 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Provide an offline-only recording setup and focus view that persists the current card, display mode, and font scale, restores an interrupted session, and manages the device wake lock without depending on the API.

## Acceptance

- A recording can start at any non-deleted card and restores its saved cursor after a new store instance is constructed.
- Previous/next navigation is clamped, and every cursor or display-setting change is persisted locally.
- Cue/full-text mode remains global across cards; full-text scrolling remains usable and each card keeps an in-memory scroll position.
- Wake-lock failures are non-blocking, while finish, route leave, app background, and rendering/navigation failures attempt release.
- Buttons and segmented controls are accessible, provide at least 48×48 CSS-pixel targets, and swipes match button navigation without stealing vertical text scrolling.
- Focused tests, the complete mobile suite, strict typecheck, production build, Capacitor sync, Android unit tests, and debug APK verification pass.

## Execution rule

Work through Task 6 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 7.

## Progress

- Confirmed Tasks 001–005 are complete from Git history, task checkpoints, and the development log.
- Created branch `codex/task-006-recording` from clean `main` at `4f770b6`.
- Baseline verification passed: 74 mobile tests and strict TypeScript type checking.

## Completion evidence

- `RecordingSession` RED failed on missing recording actions/ports, then passed with selected-card start, clamped cursor moves, persisted display settings, finish cleanup, and release-on-error behavior.
- `RecordingView` RED failed on the missing focus UI, then passed setup, recovery, progress, button/swipe parity, per-card full-text scroll, 48 px controls, and background/route lifecycle behavior.
- Review regressions first reproduced lost rapid mutations, background/resume and unmount/load wake-lock races, discarded native warnings, an unbounded focus card, duplicate cue keys, and full→cues→full scroll loss; the final focused suite covers each correction.
- The complete API/mobile, strict typecheck, production build, Capacitor sync, and Android debug verification matrix passes.

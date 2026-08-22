# Task 018 — adaptive cues and offline readiness

**Status:** In progress on `codex/task-018-adaptive-cues-offline`

## Outcome

Generate a semantically sufficient variable number of speaking cues per card and make synchronized results explicitly verifiable and usable from the phone's local SQLite database without internet access.

## Progress

- [x] Product intent, adaptive cue policy, offline flow, and release boundary approved.
- [x] Isolated worktree created and clean API/mobile baselines verified.
- [ ] Adaptive server AI and sync contracts implemented through RED/GREEN TDD.
- [ ] Mobile editor and offline-readiness status implemented through RED/GREEN TDD.
- [ ] Server-to-SQLite offline restart regression verified.
- [ ] Full verification, production deployment, live AI smoke, and signed APK completed.

## Baseline evidence

- `cd apps/api && php artisan test`: 98 passed, 1 skipped, 684 assertions after creating an ignored worktree-local test `.env`/`APP_KEY`.
- `cd apps/mobile && npm run test:unit`: 40 files, 211 tests passed.

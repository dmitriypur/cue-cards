# Task 018 — adaptive cues and offline readiness

**Status:** Complete

## Outcome

Generate a semantically sufficient variable number of speaking cues per card and make synchronized results explicitly verifiable and usable from the phone's local SQLite database without internet access.

## Progress

- [x] Product intent, adaptive cue policy, offline flow, and release boundary approved.
- [x] Isolated worktree created and clean API/mobile baselines verified.
- [x] Adaptive server AI and sync contracts implemented through RED/GREEN TDD.
- [x] Mobile editor and offline-readiness status implemented through RED/GREEN TDD.
- [x] Server-to-SQLite offline restart regression verified.
- [x] Full verification, production deployment, live AI smoke, and signed APK completed.

## Baseline evidence

- `cd apps/api && php artisan test`: 98 passed, 1 skipped, 684 assertions after creating an ignored worktree-local test `.env`/`APP_KEY`.
- `cd apps/mobile && npm run test:unit`: 40 files, 211 tests passed.

## Implementation evidence

- Server RED/GREEN removed the fixed 3–5 range, retained the non-empty/unique/200-character safeguards, added script-title and ordered-outline context, and advanced the provider prompt to version 2. Focused API verification passed 38 tests with 341 assertions.
- Mobile RED/GREEN now accepts one or more cues, removes the five-item editor ceiling, derives `offlineReadyCardCount` from ready source-hash-matching SQLite rows, and refreshes the library after sync completion. Focused verification passed 59 tests.
- The SQLite sync regression downloads six cues, reconstructs repositories as after restart, proves an offline run performs no gateway calls, preserves full text, and starts a local recording session. The extended Playwright journey renders all six cues after offline reload.
- Full local verification passed: API 98 passed/1 skipped with 692 assertions plus Pint; mobile 218/218, strict typecheck, production build with 189 modules, deterministic OpenAPI generation, and Playwright 3/3.
- Capacitor sync passed and Gradle `testDebugUnitTest assembleDebug` completed 297 tasks. The signed production release completed 360 tasks; APK metadata is `app.cuecards.mobile` version code 2/name 1.1, production origin is embedded, APK Signature Scheme v2 has the existing RSA-4096 signer, and SHA-256 is `ef905b50dfe773e33cb0176c9ecd95db6599263cdc2f5502350e16aee06dea54`.
- ADB reported no connected devices, so installation and physical-device offline smoke were not attempted.
- Merged and deployed exact SHA `fbe335bd8f7905ff37cf450a221d64f9feb5b338`; GitHub Actions run `32558152201` passed API, PostgreSQL 16, Mobile, Mobile E2E, Android debug, and Deploy API. Production checkout matched the SHA, HTTPS `/up` returned 200, and the AI worker was RUNNING.
- Production DeepSeek smoke passed login 200 and generation completion with adaptive cue counts 8 and 1, prompt version 2, unchanged full text, matching source hashes, valid cues, and verified temporary-user cleanup. The existing production `.env` prompt override was advanced from 1 to 2 and PHP-FPM/worker were restarted.
- The verified APK is available at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` in the main workspace; it remains ignored and is not committed.

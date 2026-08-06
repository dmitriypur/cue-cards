# Cue Cards development log

## 2026-08-05 — design and implementation planning

- Approved the YouTube-script Android MVP and committed the design specification.
- Chose a modular-monolith Laravel API plus a separately packaged offline-first Vue/Capacitor client.
- Confirmed local tooling: PHP 8.3.16, Composer 2.8.5, Node 24.13.0, npm 11.6.2, Java 21.0.8, Android SDK/ADB 36.0.0.
- Resolved current package metadata used by the plan: Laravel 13.24, Sanctum 4.3, Laravel AI SDK 0.10, Vue 3.5, Vite 8.2, TypeScript 7.0, Capacitor 8.5, Tailwind 4.3, and Vitest 4.1.
- Explicitly deferred Inertia and Filament from the APK MVP. Filament 5.7 is a future server-admin option.
- Created the executable TDD implementation plan and project working-document structure.
- Next action: execute Task 001, bootstrap the monorepo, and record baseline verification evidence.

## 2026-08-05 — Task 001: bootstrap the monorepo

- Scaffolded Laravel 13.24 under `apps/api`, installed Sanctum 4.3.3 and Laravel AI 0.10.2, installed API routing, and published AI configuration/stubs plus the conversation and personal-access-token migrations.
- Added `HealthTest`; focused verification `php artisan test --filter=HealthTest` passed with 1 test and 1 assertion.
- Scaffolded Vue 3.5 with strict TypeScript, Pinia, Vue Router, Tailwind CSS 4, shadcn-vue, Capacitor 8, Android, and the approved mobile adapters/tooling dependencies.
- Verified the `AppShell` TDD cycle: `npm run test:unit -- AppShell` first failed because `AppShell.vue` was unresolved, then passed with 1 test after the minimal shell and composition root were implemented.
- Corrected the dependency baseline from TypeScript 7.0.2 to 5.9.3. The installed TypeScript 7 package no longer exports `lib/tsc`, which prevents the latest `vue-tsc` 3.3.9 from starting, and `openapi-typescript` 7.13.0 requires TypeScript `^5.x`.
- Added independent API/mobile GitHub Actions jobs, repository-wide generated-artifact and secret ignore rules, and local setup/verification documentation.
- Full API verification: `php artisan test` passed with 3 tests and 3 assertions; `./vendor/bin/pint --test` passed.
- Full mobile verification: `npm run test:unit` passed with 1 test; `npm run typecheck`, `npm run build`, and `npm run test:e2e` exited successfully. The E2E gate is intentionally empty until Task 13 and is isolated to `tests/e2e`.
- Native verification: `npm run cap:sync` synchronized 6 Android plugins; `./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (26 executed, 271 up-to-date). Local verification used JDK 21 at `/opt/homebrew/Cellar/openjdk@21/21.0.8/libexec/openjdk.jdk/Contents/Home` and Android SDK at `/opt/homebrew/share/android-commandlinetools`.
- Code review found the generated instrumentation test still expected Capacitor's placeholder package. Both Android sample tests now use `app.cuecards.mobile`; `./gradlew compileDebugAndroidTestJavaWithJavac testDebugUnitTest assembleDebug` passed with 388 actionable tasks (93 executed, 295 up-to-date).
- Confirmed `.env`, local SQLite, dependency trees, web/Android builds, signing material, and generated Capacitor web assets remain ignored.
- Task 001 is complete. Task 002 was not started.

## 2026-08-06 — Task 002: mobile domain and transactional local storage

- Added strict script/card/cue domain types, Web Crypto SHA-256 hashing, and pure cue reconciliation that retains cue strings and marks hash-mismatched sets `stale`, including manually edited cues.
- Observed the domain RED: `npm run test:unit -- cueState` failed because `@/domain/scripts/cueState` did not exist. The focused GREEN passed with 4 tests, including a hand-derived SHA-256 digest for Cyrillic UTF-8 text.
- Added application repository ports, a framework-neutral SQL driver/transaction boundary, local unit of work, normalized SQLite schema v1, and repositories for scripts, outbox commands, and recording sessions.
- Observed the storage RED: `npm run test:unit -- SaveScriptAggregate` failed because the unit of work and SQLite implementation were absent. The finished integration suite passes 5 tests on Node 24's real in-memory SQLite.
- `SaveScriptAggregate` now writes a complete aggregate and one `script.replace` snapshot in the same transaction. The suite proves an injected outbox failure leaves scripts, cards, and cue sets empty.
- Pending outbox snapshots coalesce while preserving operation ID and base version. An in-flight command remains immutable and receives exactly one new pending successor.
- Review exposed that delete/reinsert snapshot persistence cascaded into `recording_sessions`. A new regression test first failed with a missing recording cursor; card/cue UPSERTs now preserve the cursor while deleting only cards absent from the snapshot.
- `CapacitorSqlDriver` is the only application module importing `@capacitor-community/sqlite`; native bootstrap applies migrations before router initialization. Foreign keys, schema tracking, all required local tables, and the card/outbox indexes are present.
- Final mobile verification: `npm run test:unit` passed 10 tests in 3 files; `npm run typecheck`, `npm run build`, and `npm run cap:sync` exited successfully. Vitest prints Node's upstream experimental warning for the built-in `node:sqlite` test adapter.
- Final native verification: `./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (26 executed, 271 up-to-date). The two existing Capacitor `flatDir` warnings remain unchanged.
- Task 002 is complete. Task 003 was not started.

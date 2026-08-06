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

## 2026-08-06 — Task 003: Markdown/TXT import and correctable preview

- Added synthetic Cyrillic Markdown/TXT fixtures. Markdown parsing uses `#` for the title, `##` for cards, preserves `###` in full text, normalizes line endings, and reports empty blocks. TXT parsing follows the documented 1–80 character punctuation-free isolated-line heuristic and reports ambiguous structure without AI.
- Observed focused RED failures for the missing Markdown parser, TXT parser, source validation, draft editor, Capacitor picker, import workflow, aggregate builder, source view, and preview components; each focused suite passed after its minimal implementation.
- Source validation accepts only `.md`/`.txt`, rejects empty or over-1-MiB UTF-8 content using both metadata and actual byte length, and records a SHA-256 import hash. The Capacitor adapter decodes selected bytes with fatal UTF-8 validation.
- Preview changes remain in Pinia memory until Save. Split, merge, reorder, rename, empty-block removal, semantic warning/error surfaces, and Save blocking are covered. Cancel clears only the draft.
- `SaveImportDraft` creates client identifiers, content hashes, missing cue sets, and a pending aggregate, then delegates persistence to Task 002's transactional `SaveScriptAggregate`; no network request participates in the local save.
- Final API verification: `php artisan test` passed 3 tests/3 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 45 tests in 12 files; `npm run typecheck`, `npm run build`, and `npm run cap:sync` exited successfully.
- Final native verification: `./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (29 executed, 268 up-to-date). The two existing Capacitor `flatDir` warnings remain unchanged.
- Task 003 is complete. Task 004 was not started.

## 2026-08-06 — Task 004: offline library and local script lifecycle

- Added application actions for deterministically sorted local summaries and opening scripts. Record/Edit navigation updates `lastOpenedAt`, `updatedAt`, and `syncStatus` through `SaveScriptAggregate` before changing routes, so the edit remains SQLite-first and shares the transactional outbox path.
- Observed the library RED: `npm run test:unit -- LibraryView` failed because the view did not exist. The completed component/store suite covers empty and populated libraries, cue/sync badges, offline transitions, semantic tile foregrounds, Import/Record/Edit actions, safe action errors, deletion confirmation/cancellation, snackbar Undo, and refreshed ordering after restore.
- Observed the application RED: `npm run test:unit -- LibraryActions` failed because `ListScripts` and `GetScript` did not exist. The focused suite verifies last-opened/update ordering, touch-before-return persistence, and rejection of missing/deleted scripts.
- Observed the delete RED: `npm run test:unit -- DeleteScript` failed because the action did not exist. Real in-memory SQLite tests prove soft-delete plus outbox coalescing, pending Undo replacement, one successor after an in-flight deletion, and preservation of independent card tombstones even when their timestamp equals the script deletion timestamp.
- Review identified and tests reproduced five correctness gaps: child tombstone resurrection, action errors hiding the list, stale Undo summaries, non-reactive connectivity, and a missing destructive foreground token. Each was corrected; the final independent re-review reported no remaining Critical or Important findings.
- Final API verification: `php artisan test` passed 3 tests/3 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 59 tests in 17 files; `npm run typecheck`, `npm run build`, and `npm run cap:sync` exited successfully. Vitest retains Node's upstream experimental warning for the built-in `node:sqlite` adapter.
- Final native verification: `./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (29 executed, 268 up-to-date). The two existing Capacitor `flatDir` warnings remain unchanged.
- Task 004 is complete. Task 005 was not started.

## 2026-08-06 — Task 005: card editor and stale-cue rules

- Added immutable application actions for card title/text updates, exact card reordering, Unicode code-point-safe splitting, merge-with-next, and 3–5 manual cue edits. Every successful mutation delegates once to `SaveScriptAggregate`, keeps the original `sourceText`, and marks the aggregate pending for sync.
- Observed the application RED: `npm run test:unit -- CardEditing` failed because the editor action modules did not exist. Focused GREEN passes 9 tests covering content hashes, retained stale cues, exact order validation, split/merge boundaries, and manual cue validation without full-text replacement.
- Added the Pinia editor store, injected dependencies, editor route, draggable/reorder controls, accessible split/merge dialogs, editable cue lists, semantic light/dark surfaces, and minimum 48×48 controls. Text edits debounce for 350 ms and flush on app background/unmount before dependent mutations.
- Observed the component RED: `npm run test:unit -- ScriptEditorView` failed because the editor dependency/view modules did not exist. The completed component suite covers card count/statuses, local save state, fields, reorder, split, confirmed merge, manual cues, background flush, and semantic/accessibility contracts.
- Review reproduced a snapshot race: flushing two pending cards started two `UpdateCard` actions concurrently. The regression test failed with two calls before the first completed; `flushAll` now persists drafts sequentially so every action reads the preceding committed local aggregate.
- Extracted Capacitor app-state subscription into an infrastructure adapter. Focused RED failed on the missing adapter; GREEN proves registered and late-registering native listener handles are both removed during cleanup. Added the missing accessible drag handle required by `vue-draggable-plus`.
- Final API verification: `php artisan test` passed 3 tests/3 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 74 tests in 20 files; `npm run typecheck`, `npm run build`, and `npm run cap:sync` exited successfully. Vitest retains Node's upstream experimental warning for the built-in `node:sqlite` adapter.
- Final native verification: `env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (29 executed, 268 up-to-date). The two existing Capacitor `flatDir` warnings remain unchanged.
- Task 005 is complete. Task 006 was not started.

## 2026-08-06 — Task 006: offline recording focus mode

- Added offline-only recording actions for starting at any active card, clamped previous/next navigation, persisted global cue/full mode and font scale, and explicit finish cleanup. Session writes use the existing SQLite recording repository and never depend on connectivity or the API.
- Observed the application RED: `npm run test:unit -- RecordingSession` failed because the recording actions and wake-lock port were absent. The completed action suite passes selected-card start, cursor bounds, display persistence, finish release, and release after a failed local navigation write.
- Added recording setup/focus views, progress and card titles, segmented mode controls, bounded internal full-text scrolling, 48×48 controls, horizontal swipe thresholds, per-card full-text scroll restoration, persistent session recovery, and the real `/scripts/:id/record` route.
- Observed the UI RED: `npm run test:unit -- RecordingView` failed because the recording view did not exist. Later RED regressions reproduced rapid double-action snapshot loss, full→cues→full scroll loss, background/resume wake-lock gaps, route cleanup racing an in-flight acquire, and a load acquiring after unmount; all now pass through one serialized session/lifecycle queue.
- Added `CapacitorWakeLock` around `KeepAwake.keepAwake()`/`allowSleep()`. Unsupported or failed native calls remain non-blocking and surface a safe localized warning. App background releases the lock, resume reacquires it, and route cleanup is ordered after pending lifecycle work.
- Independent code review identified and verified fixes for mutation races, lifecycle races, unbounded focus content, discarded wake-lock warnings, duplicate cue keys, and mode-corrupted scroll offsets. No Critical or Important issue remains in the final reviewed snapshot.
- Final API verification: `php artisan test` passed 3 tests/3 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 90 tests in 23 files; `npm run typecheck`, `npm run build`, and `npm run cap:sync` exited successfully. Vitest retains Node's upstream experimental warning for the built-in `node:sqlite` adapter.
- Final native verification: `env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (29 executed, 268 up-to-date). The two existing Capacitor `flatDir` warnings remain unchanged.
- Task 006 is complete. Task 007 was not started.

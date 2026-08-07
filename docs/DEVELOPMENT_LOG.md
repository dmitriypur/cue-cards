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

## 2026-08-06 — Task 007: Laravel identity, scripts, and superadmin access

- Confirmed Tasks 001–006 from Git merges, completed task checkpoints, and recorded verification evidence before starting Task 007 on `codex/task-007-api-identity`.
- Added backed server-owned `Role` and product `Feature` enums plus `EntitlementService`. `superadmin` is checked first and receives every current/future enum feature; ordinary users receive only explicit free features, and rate/payload/usage safeguards are not commercial entitlements.
- Observed identity RED on missing classes; focused GREEN passed 6 tests/16 assertions.
- Added portable UUID-keyed scripts/cards/cue-set migrations, integer optimistic versions, deterministic card positions, JSON cues, indexes, soft deletes, and the user role column without database-specific SQL.
- Observed auth RED as four 404 responses for missing endpoints. Implemented closed Sanctum login/logout, `/api/v1/me`, validation, resources, and safe stable error envelopes. Follow-up RED reproduced unsafe default 405/500 payloads; GREEN now sanitizes API HTTP and unexpected errors without exposing traces or exception messages.
- Added equivalent password-hash work for unknown emails, current-token-only logout, authenticated `/me` coverage, full superadmin entitlements, and absence of password/access-token fields from identity responses.
- Observed script-read RED with the owner path still returning 404. Implemented Eloquent persistence maps, `ScriptPolicy::denyAsNotFound`, one `GetScript` action, deterministic eager loading, and a resource that keeps other users' nested cards/cues inaccessible.
- Observed seeder RED on the missing class. `SuperadminSeeder` now requires `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD`, assigns the server role, and relies on the model's hashed password cast; `.env.example` contains only empty field names.
- Added an independent PostgreSQL 16 GitHub Actions job with `pdo_pgsql` and the same API suite. Local PostgreSQL parity was not executed because Docker was stopped and no local PostgreSQL server responded; CI remains the acceptance gate for that environment.
- Independent code review found no Critical issues. The Important generic API error-envelope issue and Minor unknown-email timing plus `/me` contract gaps were corrected.
- Final API verification: `php artisan test` passed 23 tests/97 assertions; `./vendor/bin/pint --test` passed.
- Disposable SQLite verification: `migrate:fresh --seed --force` completed all migrations and `SuperadminSeeder` using synthetic environment values.
- Mobile regression verification: `npm run test:unit` passed 90 tests in 23 files; `npm run typecheck` and `npm run build` exited successfully. The existing Node experimental SQLite warning remains unchanged.
- Task 007 is complete. Task 008 was not started.

## 2026-08-07 — Task 008: OpenAPI contract and secure mobile authentication

- Confirmed Tasks 001–007 from Git merges, completed task checkpoints, and recorded verification evidence before starting Task 008 on `codex/task-008-openapi-auth` from clean `main` at `773c83c`.
- Added the canonical OpenAPI 3.0 contract for login, logout, identity, script reads, sync commands/change feed, and script/card AI generation status. It defines bearer authentication, UUID/versioned aggregate snapshots, stable error envelopes, and explicit 401/404/409/422/429 responses.
- Observed contract RED: `php artisan test --filter=OpenApiContractTest` failed all four cases because `docs/api/openapi.yaml` was missing. GREEN passes 4 tests/213 assertions, maps every implemented Laravel route to an operation ID, and validates representative login/me/script examples against their schemas.
- Added `symfony/yaml` as a dev-only API dependency, generated and committed `apps/mobile/src/infrastructure/api/generated/schema.ts`, corrected `contract:generate`, and added a CI drift gate. Regeneration retained the same Git object hash `ba6b5332b1f7f1a1137ae0a82e2e6b6c995ec0d8`.
- Observed auth-action RED on absent Login/Logout/TokenStore/client modules. GREEN covers storing the token before `/me`, clearing it after failed identity loading, clearing local credentials despite offline logout, missing-token local-only mode, and expired-token cleanup.
- Observed ApiClient RED (`ApiClient is not a constructor`). GREEN covers bearer and correlation headers, JSON requests, no-content responses, AbortController timeout, stable API error normalization, and exclusion of the bearer token from serialized errors.
- Observed SecureTokenStore RED on the missing adapter. GREEN proves `cue_cards.sanctum_token` is the only affected key; `SecureTokenStore` remains the only application module importing the Capacitor secure-storage package.
- Observed LoginView/auth-guard RED on missing modules, then additional RED regressions for the absent first-launch login redirect and invisible local-only entry. GREEN covers email/password/device name, loading, invalid credentials, offline explanation, password non-persistence, authenticated redirect, explicit local-library access, and direct local recording access after token expiry.
- Review found and corrected four Important gaps: first launch bypassed login, application actions depended on an infrastructure request abstraction, OpenAPI combined a `/api/v1` server with already-prefixed paths, and the cue status enum omitted `generating`. No Critical or Important issue remains in the final reviewed snapshot.
- Final API verification: `php artisan test` passed 27 tests/310 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 106 tests in 27 files; `npm run typecheck`, `npm run build`, and `npm run test:e2e` exited successfully. Vitest retains Node's upstream experimental warning for the built-in `node:sqlite` adapter.
- Contract/native verification: deterministic `npm run contract:generate`, `npm run cap:sync`, and `env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew testDebugUnitTest assembleDebug` passed; Gradle reported 297 actionable tasks (29 executed, 268 up-to-date) and only the two unchanged `flatDir` warnings.
- PostgreSQL 16 contract/auth parity remains covered by the existing CI job; no local PostgreSQL server or Docker daemon was used for this task.
- Task 008 is complete. Task 009 was not started.

## 2026-08-07 — Task 009: idempotent Laravel synchronization

- Confirmed Tasks 001–008 from Git history, task checkpoints, and this development log before continuing Task 009 on `codex/task-009-sync` from `main` at `6fe233c`.
- Added immutable script snapshot/content-hash validation, transactional ordered snapshot application, atomic operation claims for exact retry idempotency, optimistic version conflicts preserving both snapshots, soft deletes, and a per-user cursor change feed.
- Added portable operation/change-feed migrations and a forward migration replacing the physical `(script_id, position)` unique constraint with an index; active positions remain domain-validated while deleted card tombstones can retain a position reused by an active card.
- Added bounded batches/snapshots/pages, per-user rate limiting, correlation IDs, stable validation/conflict envelopes, ownership checks for nested card/cue UUIDs, and allowlisted sync logs containing no script text or secrets.
- Review RED regressions reproduced nested UUID takeover, malformed domain payload 500s, mobile-delete incompatibility, tombstone position conflicts, overlong cues, permissive timestamps, OpenAPI relationship-ID drift, and the concurrent exact-retry race. The focused GREEN paths now pass on SQLite; the PostgreSQL race test uses two synchronized processes.
- OpenAPI now includes `script_id`/`card_id` and a 200-character cue maximum. `npm run contract:generate` is deterministic at Git object hash `2c697895ac999cce999cc673d397933859a55fe9` and generated TypeScript is committed with the contract change.
- Pre-review PostgreSQL verification used a disposable local cluster and passed 52 tests/454 assertions. The dedicated concurrent PostgreSQL test then reproduced the pre-fix race as RED. The first post-fix full run exposed test-state leakage from that non-transactional race test; a scoped teardown fixed the test isolation rather than changing production behavior.
- Final PostgreSQL verification: the disposable-cluster `php artisan test` run passed 64 tests/493 assertions, including the two-process concurrent exact-retry test; the cluster was stopped and removed afterward.
- Final SQLite API verification: `php artisan test` passed 64 tests with 63 passed, 1 PostgreSQL-only skipped, and 486 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 106 tests in 27 files; `npm run typecheck`, `npm run build`, and `npm run test:e2e` exited successfully. The existing Node experimental SQLite warning remains unchanged.
- Final contract/native verification: deterministic `npm run contract:generate` retained Git object hash `2c697895ac999cce999cc673d397933859a55fe9`; `npm run cap:sync` passed; `env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (26 executed, 271 up-to-date) and only the two unchanged `flatDir` warnings.
- Independent final review found no remaining Critical or Important code issues after the regression fixes.
- Task 009 is complete. Task 010 was not started.

## 2026-08-07 — Task 010: mobile outbox synchronization and explicit conflicts (complete)

- Confirmed Tasks 001–009 from Git merges, completed task checkpoints, and this log before starting Task 010 in isolated worktree branch `codex/task-010-mobile-sync` from clean `main` at `85ba8af`.
- Observed `RunSync` RED on the missing application action, then built one process-wide mutex for startup, network, resume, and manual triggers. Real in-memory SQLite coverage verifies offline no-op, FIFO upload, acknowledgement-after-acceptance, exact retry after restart, five-save coalescing, in-flight successor rebasing, duplicate-safe acceptance, and cursor persistence.
- Added bounded 2/5/15/30/60-second retry metadata with jitter and automatic scheduling for both upload and change-feed failures. Authentication and conflicts stop automatic work and expose explicit UI states.
- Added transactional remote-page application. Regression tests prove a failed snapshot rolls back all page writes and cursor advancement, while an older remote AI result cannot replace fresh local full text or a cue set whose `source_hash` no longer matches.
- Added the OpenAPI-backed HTTP sync gateway, deterministic snake/camel mapping, Capacitor Network adapter, persistent `002_sync_conflicts` migration, conflict repository, and explicit `useServer` / `duplicateLocal` actions. Local duplication assigns fresh UUIDv7 IDs to the script, cards, cue sets, and outbox operation while preserving both full-text copies.
- Added global offline/syncing/current/retrying/auth/conflict status UI, manual recovery actions, side-by-side conflict titles/timestamps, and navigation back to the original plus duplicated script. Startup, connectivity, and app-resume wiring all delegate to the same `RunSync` instance.
- Review RED regressions reproduced and corrected stale conflict snapshots during/after in-flight requests, silent pending-command rebases, deferred retry loss/overtaking, absorbed follow-up triggers, overlapping single-connection SQLite operations, nullable-to-real cue-set identity replacement, and deleted-card resurrection. Every fix has a focused RED/GREEN test; the final review found no remaining Critical or Important code issue.
- Successful login and committed local saves now trigger the same process-wide sync action. Manual runs bypass a persisted delay, startup restores exactly one timer, transient queued triggers receive a follow-up pass, and successful work cancels obsolete retry timers.
- Final API verification with an ephemeral synthetic `APP_KEY`: `php artisan test` passed 64 tests with 63 passed, 1 PostgreSQL-only skipped, and 486 assertions; `./vendor/bin/pint --test` passed.
- Final mobile verification: `npm run test:unit` passed 150 tests in 32 files; `npm run typecheck`, `npm run build`, `npm run test:e2e`, deterministic `npm run contract:generate` at Git object hash `8631ef48065b59bb2a36a3746e66ecadd779cc61`, and `npm run cap:sync` all exited successfully. Vitest retains Node's upstream experimental SQLite warning.
- Final native verification: `env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew testDebugUnitTest assembleDebug` completed successfully with 297 actionable tasks (26 executed, 271 up-to-date) and only the two unchanged `flatDir` warnings.
- Android offline/online smoke passed on AVD `cue_cards_task010_api34` using `system-images;android-34;aosp_atd;arm64-v8a`: `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` installed the 24 MB debug APK; `adb shell am start -W -n app.cuecards.mobile/.MainActivity` cold-started successfully; `adb shell cmd connectivity airplane-mode enable/disable` preserved PID `2034`. WebView DevTools evidence recorded `navigator.onLine` as `true -> false -> true` and the status text as `Войдите для синхронизации -> Офлайн — изменения сохранены на устройстве -> Войдите для синхронизации`.
- Task 010 is complete and ready to commit/merge. Task 011 has not started.

## 2026-08-07 — Task 011: structured AI cues, usage accounting, and source preservation (in progress)

- Confirmed Tasks 001–010 from Git merges, completed task checkpoints, and this development log before starting Task 011 on `codex/task-011-ai-cues` from clean `main` at `70a78cf`.
- Corrected the stale unchecked Task 010 checklist in the detailed plan; its task checkpoint, verification evidence, feature commit, and merge had already established completion.
- Baseline API verification passed 64 tests with 63 passed, 1 PostgreSQL-only skipped, and 486 assertions; `./vendor/bin/pint --test` passed.
- Added validated AI request/result objects, a Laravel AI/DeepSeek structured adapter, ownership-safe generation endpoints, database-queue orchestration, deterministic prompt batching, hash/manual-edit guards, safe three-attempt failure handling, per-provider-call usage accounting, and one transactional sync snapshot per completed generation.
- TDD RED/GREEN covered domain validation, API ownership/entitlements/rate limits, provider adapter mapping, success/failure/batching, prompt byte limits, source preservation, stale hashes, manual cues, usage, and exception sanitization.
- Final SQLite API verification passed 88 tests with 87 passed, 1 PostgreSQL-only skipped, and 615 assertions; Pint passed. Final PostgreSQL parity passed 88 tests/622 assertions.
- Mobile regression passed 150 tests in 32 files, strict typecheck, production build, and E2E gate. OpenAPI generation was deterministic at Git object hash `3da42f7bc0e3800e9e997bfd27e5dcba17970e74`.
- Closed the missing operational verification with a disposable SQLite database queue smoke: a synthetic probe was dispatched to queue `ai`, the real command `php artisan queue:work --queue=ai --tries=3 --stop-when-empty --verbose` reported `DONE`, and direct database verification returned `jobs=0`, `failed_jobs=0`, marker=`processed`. The probe class was removed after the run and no external AI request was made.
- Task 011 is complete. Task 012 was not started.

# Cue Cards YouTube MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Laravel API and deliver a signed, sideloadable Android APK that imports a YouTube script from Markdown or TXT, stores it offline as editable cards, generates 3–5 AI cues per card through Laravel/DeepSeek, synchronizes safely, and gives the creator-superadmin unrestricted product access.

**Architecture:** A monorepo contains a Laravel modular-monolith JSON API and a separately packaged Vue/Capacitor offline-first client. The mobile application commits all edits to SQLite and records an outbox command before networking; Laravel applies aggregate snapshots transactionally with idempotency and optimistic locking. AI, secure storage, SQLite, file picking, wake lock, and HTTP are adapters behind application ports.

**Tech Stack:** PHP 8.3, Laravel 13, Sanctum, Laravel AI SDK, PostgreSQL/SQLite, database queue, Vue 3, strict TypeScript, Pinia, Vue Router, Vite, Tailwind CSS 4, shadcn-vue, Capacitor 8, Android SDK, Vitest, Vue Test Utils, Playwright, PHPUnit, and Laravel Pint.

## Global Constraints

- Implement tasks in numerical order. A task is complete only after its focused tests, relevant full suites, and listed commit succeed.
- Use the approved specification at `docs/superpowers/specs/2026-08-05-cue-cards-youtube-mvp-design.md` as the product source of truth.
- Use test-driven development for every behavior: create the failing test, observe the intended failure, add the smallest implementation, and rerun the focused test before refactoring.
- Keep controllers, queued jobs, Eloquent models, Vue components, and Pinia stores thin. Business decisions belong in domain objects or application actions.
- Every mobile mutation is SQLite-first and creates an outbox record in the same transaction. A network failure must never roll back a user edit.
- The server owns roles and entitlements. `superadmin` always receives every product entitlement and bypasses commercial AI quotas, while rate limiting, payload limits, retries, and usage accounting remain active.
- Never log or commit script text, passwords, access tokens, AI credentials, Android signing keys, or keystore passwords.
- Use synthetic UTF-8 Cyrillic fixtures. Do not copy the user's personal scenario file into the repository.
- Use portable Laravel migrations and run server tests against SQLite on every task; add PostgreSQL parity before sync is accepted.
- Commit `composer.lock`, `package-lock.json`, and generated OpenAPI TypeScript types. Do not commit build output or local databases.
- Inertia 3.6 and Filament 5.7 are deliberately excluded from the MVP. Filament may later be installed only in `apps/api` for server administration.

## Resolved Dependency Baseline

Package metadata was checked on 2026-08-05. Lock files created during Task 1 are authoritative for transitive versions.

| Package | Version |
|---|---:|
| `laravel/framework` | 13.24.0 |
| `laravel/sanctum` | 4.3.3 |
| `laravel/ai` | 0.10.2 |
| `vue` | 3.5.41 |
| `vite` | 8.2.0 |
| `typescript` | 5.9.3 |
| `pinia` | 4.0.2 |
| `vue-router` | 5.2.0 |
| `tailwindcss` | 4.3.3 |
| `@tailwindcss/vite` | 4.3.3 |
| `@vitejs/plugin-vue` | 6.0.8 |
| `@vue/tsconfig` | 0.9.1 |
| `shadcn-vue` | 2.8.1 |
| `lucide-vue-next` | 1.0.0 |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | 8.5.0 |
| `@capacitor-community/sqlite` | 8.1.0 |
| `@aparajita/capacitor-secure-storage` | 8.0.0 |
| `@capawesome/capacitor-file-picker` | 8.0.4 |
| `@capacitor-community/keep-awake` | 8.0.1 |
| `@capacitor/network` | 8.0.1 |
| `@capacitor/app` | 8.1.1 |
| `uuid` | 14.0.1 |
| `zod` | 4.4.3 |
| `openapi-typescript` | 7.13.0 |
| `vue-draggable-plus` | 0.6.1 |
| `vitest` | 4.1.10 |
| `@vue/test-utils` | 2.4.11 |
| `happy-dom` | 20.11.1 |
| `@playwright/test` | 1.62.1 |

TypeScript was corrected to 5.9.3 during Task 1 verification: TypeScript 7.0.2 uses the native compiler layout and is not compatible with `vue-tsc` 3.3.9 or the `typescript ^5.x` peer range required by `openapi-typescript` 7.13.0.

## Target File Map

### Repository root

- `AGENTS.md`: immutable product and engineering rules.
- `README.md`: local setup, daily commands, and high-level architecture.
- `.github/workflows/ci.yml`: API, mobile, contract, Android quality gates, and production API auto-deploy.
- `docs/api/openapi.yaml`: canonical `/api/v1` transport contract.
- `docs/IMPLEMENTATION_PLAN.md`: phase summary.
- `docs/tasks/NNN-current-task.md`: one numbered execution checkpoint per task; the highest incomplete task is active.
- `docs/DEVELOPMENT_LOG.md`: dated verification evidence and decisions.

### Laravel API

- `apps/api/app/Domain/Identity`: role and entitlement concepts.
- `apps/api/app/Domain/Scripts`: aggregate snapshots, content hashes, and cue state rules.
- `apps/api/app/Application/Auth`: login/logout use cases.
- `apps/api/app/Application/Scripts`: read-model and snapshot actions.
- `apps/api/app/Application/Sync`: idempotent command processing and change feed.
- `apps/api/app/Application/AiAssistance`: generation orchestration and provider port.
- `apps/api/app/Application/Usage`: usage recording.
- `apps/api/app/Infrastructure/Ai`: Laravel AI SDK adapter and structured agent.
- `apps/api/app/Http/Controllers/Api/V1`: transport-only controllers.
- `apps/api/app/Http/Requests/Api/V1`: request validation.
- `apps/api/app/Http/Resources/Api/V1`: stable response shapes.
- `apps/api/app/Jobs`: queue entry points delegating to application actions.
- `apps/api/app/Models`: persistence mapping only.
- `apps/api/app/Policies`: ownership checks.
- `apps/api/database/migrations`: portable schema.
- `apps/api/tests/Unit`, `tests/Feature`, `tests/Integration`: domain, HTTP, database, queue, and contract tests.

### Vue/Capacitor mobile app

- `apps/mobile/src/domain`: entities, value objects, hashes, and pure invariants.
- `apps/mobile/src/application`: use cases and repository/platform ports.
- `apps/mobile/src/infrastructure/sqlite`: migrations, driver, repositories, and transactions.
- `apps/mobile/src/infrastructure/api`: generated types, authenticated client, and API adapters.
- `apps/mobile/src/infrastructure/capacitor`: secure storage, file picker, connectivity, and wake lock.
- `apps/mobile/src/features/auth`: login flow.
- `apps/mobile/src/features/library`: local script library.
- `apps/mobile/src/features/import`: parsing and editable preview.
- `apps/mobile/src/features/editor`: card editing and ordering.
- `apps/mobile/src/features/recording`: offline focus mode.
- `apps/mobile/src/features/sync`: outbox worker and conflict UI.
- `apps/mobile/src/features/ai-cues`: generation commands and status.
- `apps/mobile/src/shared/ui`: design primitives with semantic color tokens.
- `apps/mobile/tests`: fixtures, integration adapters, and Playwright journeys.
- `apps/mobile/android`: generated Capacitor Android shell and signing configuration.

---

## Task 1: Bootstrap the monorepo and quality gates

**Files:**

- Create: `README.md`
- Modify: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: `apps/api/` from the Laravel 13 skeleton
- Modify: `apps/api/composer.json`
- Modify: `apps/api/phpunit.xml`
- Modify: `apps/api/.env.example`
- Create: `apps/api/tests/Feature/HealthTest.php`
- Create: `apps/mobile/` from the Vue TypeScript Vite skeleton
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/tsconfig.app.json`
- Create: `apps/mobile/vitest.config.ts`
- Create: `apps/mobile/capacitor.config.ts`
- Create: `apps/mobile/src/App.vue`
- Create: `apps/mobile/src/app/router.ts`
- Create: `apps/mobile/src/app/bootstrap.ts`
- Create: `apps/mobile/src/styles/index.css`
- Create: `apps/mobile/components.json`
- Create: `apps/mobile/src/shared/ui/AppShell.vue`
- Create: `apps/mobile/src/shared/ui/__tests__/AppShell.test.ts`
- Generate: `apps/mobile/android/`

**Interfaces:**

- Produces `bootstrapApp(): Promise<void>` as the single mobile composition root.
- Produces `GET /up -> 200` from Laravel's health route.
- Consumes no product interfaces; this task establishes the build boundary used by all later tasks.

- [x] Scaffold Laravel without nesting another Git repository: `composer create-project laravel/laravel apps/api "^13.0" --prefer-dist` and remove only `apps/api/.git` if the skeleton created it.
- [x] In `apps/api`, require `laravel/sanctum:^4.3` and `laravel/ai:0.10.2`, run `php artisan install:api`, publish the AI configuration, and commit the resulting lock file and migrations.
- [x] Configure `apps/api/phpunit.xml` with `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`, and `MAIL_MAILER=array`.
- [x] Add `apps/api/tests/Feature/HealthTest.php` asserting `get('/up')->assertOk()` and run `cd apps/api && php artisan test --filter=HealthTest`; expected result is one passing test.
- [x] Scaffold Vue with `npm create vite@9.1.2 apps/mobile -- --template vue-ts`, then install the exact JavaScript packages from the dependency table.
- [x] Initialize Capacitor with app id `app.cuecards.mobile`, app name `Cue Cards`, web directory `dist`, add Android, and run `npx cap sync android`.
- [x] Configure Tailwind's Vite plugin, initialize shadcn-vue source components, and define paired light/dark semantic tokens in `src/styles/index.css` before creating application cards.
- [x] Add package scripts `typecheck`, `test:unit`, `test:unit:watch`, `test:e2e`, `build`, `cap:sync`, `android:debug`, and `contract:generate` using direct tool commands rather than shell-specific scripts.
- [x] Set `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables` to `true` in `apps/mobile/tsconfig.app.json`.
- [x] Write the failing `AppShell` component test before replacing the Vite starter. It must assert the visible app name and a `<main>` landmark:

```ts
it('renders the application landmark', () => {
  const wrapper = mount(AppShell, { slots: { default: 'Библиотека' } })
  expect(wrapper.get('main').text()).toContain('Библиотека')
  expect(wrapper.text()).toContain('Cue Cards')
})
```

- [x] Run `cd apps/mobile && npm run test:unit -- AppShell`; expected failure: `AppShell.vue` cannot be resolved.
- [x] Implement `AppShell.vue`, the router, Pinia registration, and `bootstrapApp()`; remove all Vite demo assets and render a neutral empty-library route.
- [x] Run `npm run test:unit -- AppShell`, `npm run typecheck`, and `npm run build`; all must pass without warnings caused by application code.
- [x] Add `.github/workflows/ci.yml` with independent `api` and `mobile` jobs using PHP 8.3, Node 24, Composer/npm caches, `php artisan test`, Pint check, unit tests, typecheck, and production build.
- [x] Expand `.gitignore` for `.env`, local SQLite files, `node_modules`, `vendor`, `dist`, Android build directories, `key.properties`, `*.jks`, `*.keystore`, and `.idea` while retaining both lock files.
- [x] Document install and verification commands in `README.md`, run the full Task 1 verification, update the development log and current-task status, then commit: `chore: bootstrap Laravel and Capacitor monorepo`.

## Task 2: Define the mobile domain and transactional local storage

**Files:**

- Create: `apps/mobile/src/domain/scripts/types.ts`
- Create: `apps/mobile/src/domain/scripts/contentHash.ts`
- Create: `apps/mobile/src/domain/scripts/cueState.ts`
- Create: `apps/mobile/src/application/ports/ScriptRepository.ts`
- Create: `apps/mobile/src/application/ports/OutboxRepository.ts`
- Create: `apps/mobile/src/application/ports/RecordingSessionRepository.ts`
- Create: `apps/mobile/src/application/scripts/SaveScriptAggregate.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/SqlDriver.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/migrations/001_initial.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/CapacitorSqlDriver.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/SqliteScriptRepository.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/SqliteOutboxRepository.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/SqliteRecordingSessionRepository.ts`
- Create: `apps/mobile/src/infrastructure/sqlite/LocalUnitOfWork.ts`
- Create: `apps/mobile/tests/helpers/InMemorySqlDriver.ts`
- Create: `apps/mobile/tests/integration/sqlite/SaveScriptAggregate.test.ts`
- Create: `apps/mobile/tests/unit/domain/cueState.test.ts`

**Interfaces:**

- Produces `ScriptAggregate`, `ScriptCard`, `CueSet`, `CueStatus`, and `SyncStatus` domain types.
- Produces `ScriptRepository.list(): Promise<ScriptSummary[]>`, `get(id: string): Promise<ScriptAggregate | null>`, `save(aggregate: ScriptAggregate, tx?: SqlTransaction): Promise<void>`, and `softDelete(id: string, deletedAt: string, tx?: SqlTransaction): Promise<void>`.
- Produces `OutboxRepository.upsertLatestSnapshot(command: OutboxCommand, tx?: SqlTransaction): Promise<void>`, `next(): Promise<OutboxCommand | null>`, `markInFlight(operationId: string): Promise<void>`, `acknowledge(operationId: string, serverVersion: number): Promise<void>`, and `rebasePending(aggregateId: string, serverVersion: number): Promise<void>`.
- Produces `SaveScriptAggregate.execute(input: SaveScriptInput): Promise<ScriptAggregate>`.
- Consumes `SqlDriver.transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T>`.

- [x] Define strict domain types with UUID strings, ISO timestamps, integer versions, ordered cards, cues as `readonly string[]`, and explicit `missing | pending | generating | ready | stale | failed` status.
- [x] Write `cueState.test.ts` first: unchanged text keeps a ready cue set, changed text keeps its cues but marks it stale, and manually edited cues are never cleared.
- [x] Run `npm run test:unit -- cueState`; expected failure: `reconcileCueState` is missing.
- [x] Implement `sha256(text): Promise<string>` with Web Crypto and `reconcileCueState(cueSet, nextHash)` as a pure function; rerun the focused test to green.
- [x] Define the SQL driver and transaction interfaces without importing Capacitor types into application or domain folders.
- [x] Add migration `001_initial.ts` creating `scripts`, `cards`, `cue_sets`, `outbox_commands`, `sync_state`, `recording_sessions`, `settings`, and `schema_migrations`; give outbox rows `pending | in_flight` state, attempts, and next-attempt time, enable foreign keys, and index `cards(script_id, position)` plus `outbox_commands(state, created_at)`.
- [x] Write `SaveScriptAggregate.test.ts` first. Save a two-card aggregate and assert script, cards, cue sets, and one `script.replace` outbox command are persisted atomically.
- [x] Add a rollback assertion by making the fake driver fail on the outbox insert and verifying that no script rows remain.
- [x] Run `npm run test:unit -- SaveScriptAggregate`; expected failure: the use case and SQLite repositories do not exist.
- [x] Implement `LocalUnitOfWork` and repositories, then implement `SaveScriptAggregate` so entity writes and outbox enqueue share one SQL transaction:

```ts
return this.unitOfWork.run(async (tx) => {
  await this.scripts.save(input.aggregate, tx)
  await this.outbox.upsertLatestSnapshot({
    operationId: v7(),
    aggregateId: input.aggregate.id,
    baseVersion: input.aggregate.serverVersion,
    type: 'script.replace',
    payload: input.aggregate,
    createdAt: this.clock.now(),
  }, tx)
  return input.aggregate
})
```

- [x] Implement `CapacitorSqlDriver` as the only module importing `@capacitor-community/sqlite`; initialize migrations before the router mounts.
- [x] Make `upsertLatestSnapshot` replace the payload of an unsent `pending` command for the same aggregate while preserving its operation ID/base version; if the prior command is `in_flight`, insert one new pending command instead.
- [x] Rerun both focused tests, then `npm run test:unit`, `npm run typecheck`, and an Android debug build.
- [x] Update the development log and commit: `feat(mobile): add offline script storage and outbox`.

## Task 3: Parse Markdown/TXT and provide a correctable import draft

**Files:**

- Create: `apps/mobile/src/domain/import/types.ts`
- Create: `apps/mobile/src/application/ports/SourceFilePicker.ts`
- Create: `apps/mobile/src/application/import/MarkdownScriptParser.ts`
- Create: `apps/mobile/src/application/import/TextScriptParser.ts`
- Create: `apps/mobile/src/application/import/ParseSourceDocument.ts`
- Create: `apps/mobile/src/application/import/EditImportDraft.ts`
- Create: `apps/mobile/src/infrastructure/capacitor/CapacitorSourceFilePicker.ts`
- Create: `apps/mobile/src/features/import/import.store.ts`
- Create: `apps/mobile/src/features/import/ImportSourceView.vue`
- Create: `apps/mobile/src/features/import/ImportPreviewView.vue`
- Create: `apps/mobile/src/features/import/components/ImportBlockCard.vue`
- Create: `apps/mobile/tests/fixtures/script-structured.md`
- Create: `apps/mobile/tests/fixtures/script-heuristic.txt`
- Create: `apps/mobile/tests/unit/import/MarkdownScriptParser.test.ts`
- Create: `apps/mobile/tests/unit/import/TextScriptParser.test.ts`
- Create: `apps/mobile/src/features/import/__tests__/ImportPreviewView.test.ts`

**Interfaces:**

- Produces `SourceFilePicker.pick(): Promise<SourceDocument | null>` where the document contains `name`, `mimeType`, `size`, and UTF-8 `text`.
- Produces `ParseSourceDocument.execute(source: SourceDocument): Promise<ImportDraft>`.
- Produces draft operations `rename`, `moveBlock`, `splitBlock`, `mergeWithNext`, and `removeEmptyBlock` without writing SQLite.
- Consumes `SaveScriptAggregate` only after preview validation succeeds.

- [x] Add synthetic fixtures with a Cyrillic `#` title, at least three `##` blocks, an internal `###` heading, and a TXT file with both clear and ambiguous heading candidates.
- [x] Write Markdown parser tests asserting `#` becomes the script title, every `##` starts a card, `###` remains in full text, filename is the fallback title, and empty cards produce validation issues.
- [x] Run `npm run test:unit -- MarkdownScriptParser`; expected failure: parser module not found.
- [x] Implement a line-oriented Markdown parser that preserves original block text and line endings normalized to `\n`; rerun the focused tests.
- [x] Write TXT parser tests for the exact heuristic: a candidate heading is a trimmed line of 1–80 characters, surrounded by blank lines or file boundaries, and not ending in `.`, `!`, `?`, `,`, `:`, or `;`.
- [x] Run `npm run test:unit -- TextScriptParser`; expected failure: parser module not found.
- [x] Implement the deterministic TXT parser and return warnings for ambiguous structure; never call AI from either parser.
- [x] Implement `ParseSourceDocument` validation for `.md`/`.txt`, UTF-8 decoding, a 1 MiB technical limit, empty files, and SHA-256 import hash.
- [x] Implement `CapacitorSourceFilePicker` with `FilePicker.pickFiles({ limit: 1, readData: true, types: ['text/plain', 'text/markdown'] })`; keep plugin data conversion inside the adapter.
- [x] Write the preview component test first: warnings and empty-block errors render with readable dark text on a light surface, Save is disabled for errors, and split/merge/reorder actions emit draft changes.
- [x] Run the focused component test; expected failure: preview components are absent.
- [x] Build `ImportSourceView`, `ImportPreviewView`, `ImportBlockCard`, and the import store using semantic tokens `--surface`, `--surface-foreground`, `--muted`, and `--muted-foreground`; do not use literal white text on light cards.
- [x] Add routes `/import` and `/import/preview`; Save constructs client UUIDv7 identifiers and calls `SaveScriptAggregate`, while Cancel discards only the in-memory draft.
- [x] Run parser and component suites, strict typecheck, production build, and Android debug build.
- [x] Update the development log and commit: `feat(mobile): import markdown and text scripts`.

## Task 4: Build the offline library and local script lifecycle

**Files:**

- Create: `apps/mobile/src/application/scripts/ListScripts.ts`
- Create: `apps/mobile/src/application/scripts/GetScript.ts`
- Create: `apps/mobile/src/application/scripts/DeleteScript.ts`
- Create: `apps/mobile/src/features/library/library.store.ts`
- Create: `apps/mobile/src/features/library/LibraryView.vue`
- Create: `apps/mobile/src/features/library/components/ScriptListItem.vue`
- Create: `apps/mobile/src/features/library/components/SyncBadge.vue`
- Create: `apps/mobile/src/shared/ui/ConfirmDialog.vue`
- Create: `apps/mobile/src/features/library/__tests__/LibraryView.test.ts`
- Create: `apps/mobile/tests/integration/library/DeleteScript.test.ts`

**Interfaces:**

- Produces `ListScripts.execute(): Promise<ScriptSummary[]>`, sorted by `lastOpenedAt` then `updatedAt` descending.
- Produces `DeleteScript.execute(scriptId: string): Promise<void>` that soft-deletes locally and enqueues the changed aggregate.
- Consumes `ScriptRepository`, `OutboxRepository`, and router navigation only through injected composition-root dependencies.

- [x] Write `LibraryView.test.ts` first with empty, populated, generating, stale, failed, pending-sync, and offline states; assert the primary import action and per-script Record/Edit actions.
- [x] Run `npm run test:unit -- LibraryView`; expected failure: library view and store do not exist.
- [x] Implement `ListScripts`, a store with `idle | loading | ready | failed` state, and library components without API calls in the component.
- [x] Ensure cards and text use semantic foreground tokens in light and dark themes; add a component assertion that the light script tile uses `text-surface-foreground` rather than `text-white`.
- [x] Write `DeleteScript.test.ts` first: confirmation soft-deletes the script and creates one outbox command; cancellation changes nothing.
- [x] Run the focused delete test; expected failure: `DeleteScript` is missing.
- [x] Implement deletion through `SaveScriptAggregate`/unit of work and show an undo snackbar; undo replaces the still-pending delete snapshot with the restored aggregate, or creates a new pending snapshot only when deletion is already in flight.
- [x] Wire routes `/library`, `/scripts/:id/edit`, and `/scripts/:id/record`; opening a script updates `lastOpenedAt` locally.
- [x] Run all mobile unit/integration tests, typecheck, build, and the debug Android build.
- [x] Update the development log and commit: `feat(mobile): add offline script library`.

## Task 5: Implement the card editor and stale-cue rules

**Files:**

- Create: `apps/mobile/src/application/scripts/UpdateCard.ts`
- Create: `apps/mobile/src/application/scripts/ReorderCards.ts`
- Create: `apps/mobile/src/application/scripts/SplitCard.ts`
- Create: `apps/mobile/src/application/scripts/MergeCards.ts`
- Create: `apps/mobile/src/application/scripts/UpdateCues.ts`
- Create: `apps/mobile/src/features/editor/editor.store.ts`
- Create: `apps/mobile/src/features/editor/ScriptEditorView.vue`
- Create: `apps/mobile/src/features/editor/components/EditableCard.vue`
- Create: `apps/mobile/src/features/editor/components/CueListEditor.vue`
- Create: `apps/mobile/src/features/editor/components/SplitCardDialog.vue`
- Create: `apps/mobile/tests/unit/editor/CardEditing.test.ts`
- Create: `apps/mobile/src/features/editor/__tests__/ScriptEditorView.test.ts`

**Interfaces:**

- Produces `UpdateCard.execute({ scriptId, cardId, title, fullText }): Promise<ScriptAggregate>`.
- Produces `ReorderCards.execute({ scriptId, orderedCardIds }): Promise<ScriptAggregate>`.
- Produces `SplitCard.execute({ scriptId, cardId, offset, nextTitle }): Promise<ScriptAggregate>`.
- Produces `MergeCards.execute({ scriptId, cardId }): Promise<ScriptAggregate>`.
- Produces `UpdateCues.execute({ scriptId, cardId, cues }): Promise<ScriptAggregate>` enforcing 3–5 trimmed non-empty cues and `manuallyEdited=true`.
- Consumes `SaveScriptAggregate` for every successful mutation.

- [x] Write pure use-case tests first for title/text editing, exact order normalization, split at a Unicode-safe string offset, merge with the next card, last-card merge rejection, and 3–5 cue validation.
- [x] Add assertions that editing full text recalculates `contentHash`, marks prior AI cues stale, retains cue strings, and never changes full text when cues are edited.
- [x] Run `npm run test:unit -- CardEditing`; expected failure: editor use cases are absent.
- [x] Implement the five use cases with immutable aggregate copies and one `SaveScriptAggregate` call per user action; rerun focused tests.
- [x] Write `ScriptEditorView.test.ts` first: it renders card count and statuses, saves fields, reorders, opens split/merge controls, edits individual cues, and shows an accessible confirmation before destructive actions.
- [x] Run the component test; expected failure: editor components are absent.
- [x] Implement `ScriptEditorView`, `EditableCard`, and `CueListEditor`; use `vue-draggable-plus` only in the view adapter and pass the resulting ID order to `ReorderCards`.
- [x] Debounce text field persistence by 350 ms while flushing immediately on route leave and app background; display saved/pending state from the local repository, not from network state.
- [x] Use minimum 48×48 CSS-pixel touch targets, visible focus rings, and surface/foreground pairs in both themes.
- [x] Run editor tests, the complete mobile suite, typecheck, build, and Android debug build.
- [x] Update the development log and commit: `feat(mobile): add card and cue editor`.

## Task 6: Deliver the offline recording focus mode

**Files:**

- Create: `apps/mobile/src/application/ports/WakeLock.ts`
- Create: `apps/mobile/src/application/recording/StartRecording.ts`
- Create: `apps/mobile/src/application/recording/MoveRecordingCursor.ts`
- Create: `apps/mobile/src/application/recording/FinishRecording.ts`
- Create: `apps/mobile/src/infrastructure/capacitor/CapacitorWakeLock.ts`
- Create: `apps/mobile/src/features/recording/recording.store.ts`
- Create: `apps/mobile/src/features/recording/RecordingSetupView.vue`
- Create: `apps/mobile/src/features/recording/RecordingView.vue`
- Create: `apps/mobile/src/features/recording/components/FocusCard.vue`
- Create: `apps/mobile/src/features/recording/composables/useHorizontalSwipe.ts`
- Create: `apps/mobile/tests/unit/recording/RecordingSession.test.ts`
- Create: `apps/mobile/src/features/recording/__tests__/RecordingView.test.ts`

**Interfaces:**

- Produces `WakeLock.acquire(): Promise<void>` and `WakeLock.release(): Promise<void>`.
- Produces `StartRecording.execute({ scriptId, cardId, mode, fontScale }): Promise<RecordingSession>`.
- Produces `MoveRecordingCursor.execute({ sessionId, direction }): Promise<RecordingSession>`.
- Produces `FinishRecording.execute(sessionId): Promise<void>` and always releases the wake lock.
- Consumes local `ScriptRepository` and `RecordingSessionRepository`; it consumes no API or connectivity interface.

- [x] Write session tests first for starting at any card, clamped previous/next navigation, global `cues | full` mode, font scale, and recovery after constructing a new store instance.
- [x] Add a test that wake lock release runs on normal finish and after a rendering/navigation error.
- [x] Run `npm run test:unit -- RecordingSession`; expected failure: recording actions and ports are absent.
- [x] Implement actions and persist the session after every navigation or mode change; use `try/finally` around finish and route cleanup.
- [x] Implement `CapacitorWakeLock` with `KeepAwake.keepAwake()` and `KeepAwake.allowSleep()`; a failed or unsupported plugin reports a non-blocking warning and does not break recording.
- [x] Write the component test first for progress, title, segmented cue/full switch, scrollable full text, 48 px buttons, disabled boundary actions, and swipe parity.
- [x] Run `npm run test:unit -- RecordingView`; expected failure: focus components are absent.
- [x] Implement setup and focus views. Ignore swipes starting in vertically scrollable text unless horizontal displacement exceeds 60 px and is at least 1.5 times vertical displacement.
- [x] Save the selected mode across cards, preserve independent scroll position per card in memory, and restore the saved session after force-closing the web view.
- [x] Add a router leave guard and Capacitor app-state listener that release wake lock when the recording route is no longer active.
- [x] Run recording tests, all mobile tests, typecheck, build, Android unit tests, and debug APK assembly.
- [x] Update the development log and commit: `feat(mobile): add offline recording mode`.

## Task 7: Build Laravel identity, scripts, and superadmin access

**Files:**

- Create: `apps/api/app/Domain/Identity/Role.php`
- Create: `apps/api/app/Domain/Identity/Feature.php`
- Create: `apps/api/app/Application/Identity/EntitlementService.php`
- Create: `apps/api/app/Application/Auth/Login.php`
- Create: `apps/api/app/Application/Auth/Logout.php`
- Create: `apps/api/app/Application/Scripts/GetScript.php`
- Create: `apps/api/app/Http/Controllers/Api/V1/AuthController.php`
- Create: `apps/api/app/Http/Controllers/Api/V1/MeController.php`
- Create: `apps/api/app/Http/Controllers/Api/V1/ScriptController.php`
- Create: `apps/api/app/Http/Requests/Api/V1/LoginRequest.php`
- Create: `apps/api/app/Http/Resources/Api/V1/UserResource.php`
- Create: `apps/api/app/Http/Resources/Api/V1/ScriptResource.php`
- Create: `apps/api/app/Models/Script.php`
- Create: `apps/api/app/Models/Card.php`
- Create: `apps/api/app/Models/CueSet.php`
- Create: `apps/api/app/Policies/ScriptPolicy.php`
- Modify: `apps/api/app/Models/User.php`
- Create: `apps/api/database/migrations/2026_08_05_000001_add_role_to_users.php`
- Create: `apps/api/database/migrations/2026_08_05_000002_create_scripts_table.php`
- Create: `apps/api/database/migrations/2026_08_05_000003_create_cards_table.php`
- Create: `apps/api/database/migrations/2026_08_05_000004_create_cue_sets_table.php`
- Create: `apps/api/database/seeders/SuperadminSeeder.php`
- Modify: `apps/api/database/seeders/DatabaseSeeder.php`
- Modify: `apps/api/routes/api.php`
- Create: `apps/api/tests/Unit/Identity/EntitlementServiceTest.php`
- Create: `apps/api/tests/Feature/Api/V1/AuthTest.php`
- Create: `apps/api/tests/Feature/Api/V1/ScriptReadTest.php`

**Interfaces:**

- Produces `EntitlementService::allows(User $user, Feature $feature): bool` and `allFor(User $user): array`.
- Produces `Login::handle(string $email, string $password, string $deviceName): NewAccessToken`.
- Produces `GET /api/v1/me` and ownership-protected `GET /api/v1/scripts/{script}`.
- Consumes Sanctum token issuance and Laravel Policies; no mobile transport code is imported.

- [x] Write `EntitlementServiceTest` first: `superadmin` is allowed every enum case, a normal user receives only explicitly granted free features, and technical safeguards are not represented as commercial entitlements.
- [x] Run `php artisan test --filter=EntitlementServiceTest`; expected failure: identity enums and service are missing.
- [x] Implement backed `Role` and `Feature` enums plus `EntitlementService`; make superadmin the first branch so future features are automatically included.
- [x] Add portable UUID-keyed script/card/cue-set migrations with integer optimistic `version`, JSON cues, soft deletes, ownership foreign keys, unique `(script_id, position)`, and relevant indexes.
- [x] Write API auth tests first: valid seeded login returns a bearer token and full entitlement list, invalid login returns `AUTH_INVALID_CREDENTIALS`, `/me` requires Sanctum, and logout revokes only the current token.
- [x] Run `php artisan test --filter=AuthTest`; expected failure: API routes and actions are absent.
- [x] Implement form requests, auth actions, controllers, and resources under `/api/v1`; return errors as `{ "error": { "code", "message", "correlation_id" } }`.
- [x] Implement `SuperadminSeeder` reading `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD` from environment; fail loudly when production values are absent and never place a real password in the repository.
- [x] Write ownership tests first: owner can read, another user receives 404, soft-deleted scripts are hidden, and nested cards/cues never leak across users.
- [x] Run the focused read tests; expected failure: script action/policy/resource is missing.
- [x] Implement models as persistence maps, `ScriptPolicy`, `GetScript`, eager-loading with deterministic card order, and API resources.
- [x] Add a PostgreSQL 16 CI service and a migration/test job using the same test suite; no database-specific migration branches are allowed.
- [x] Run `php artisan test`, `./vendor/bin/pint --test`, and `php artisan migrate:fresh --seed` on a disposable SQLite database; configure the PostgreSQL CI job as the environment-specific parity gate.
- [x] Update the development log and commit: `feat(api): add superadmin auth and script read model`.

## Task 8: Define OpenAPI and add secure mobile authentication

**Files:**

- Create: `docs/api/openapi.yaml`
- Create: `apps/api/tests/Feature/Api/V1/OpenApiContractTest.php`
- Create: `apps/mobile/src/infrastructure/api/generated/schema.ts`
- Create: `apps/mobile/src/application/ports/TokenStore.ts`
- Create: `apps/mobile/src/application/auth/Login.ts`
- Create: `apps/mobile/src/application/auth/Logout.ts`
- Create: `apps/mobile/src/infrastructure/capacitor/SecureTokenStore.ts`
- Create: `apps/mobile/src/infrastructure/api/ApiClient.ts`
- Create: `apps/mobile/src/features/auth/auth.store.ts`
- Create: `apps/mobile/src/features/auth/LoginView.vue`
- Create: `apps/mobile/src/app/authGuard.ts`
- Create: `apps/mobile/tests/unit/auth/AuthActions.test.ts`
- Create: `apps/mobile/src/features/auth/__tests__/LoginView.test.ts`

**Interfaces:**

- Produces the canonical OpenAPI operations `login`, `logout`, `me`, `getScript`, `getSyncChanges`, `submitSyncCommands`, `startScriptCueGeneration`, `startCardCueGeneration`, and `getAiGeneration`.
- Produces `TokenStore.get(): Promise<string | null>`, `set(token: string): Promise<void>`, and `clear(): Promise<void>`.
- Produces `ApiClient.request<T>(operation: ApiOperation<T>): Promise<T>` with bearer authentication, correlation ID, timeout, and normalized errors.
- Consumes generated `paths` types from `schema.ts`; handwritten duplicate response DTOs are prohibited.

- [x] Write `docs/api/openapi.yaml` first with `/api/v1`, bearer authentication, UUIDs, integer versions, JSON aggregate snapshots, the stable error envelope, and explicit 401/404/409/422/429 responses.
- [x] Add `contract:generate` as `openapi-typescript ../../docs/api/openapi.yaml -o src/infrastructure/api/generated/schema.ts` and generate the committed TypeScript file.
- [x] Write `OpenApiContractTest` first to load the YAML, assert every implemented Laravel route has an `operationId`, and verify the login/me/script example responses against their schemas.
- [x] Run `php artisan test --filter=OpenApiContractTest`; expected failure is any missing schema or operation mapping, not a network error.
- [x] Correct the OpenAPI document and API resources until the contract test passes; rerun `npm run contract:generate` and fail CI when regeneration changes Git output.
- [x] Write `AuthActions.test.ts` first: successful login stores the token before fetching `/me`, failed `/me` clears it, logout clears local credentials even when the server is offline, and a missing token enters local-only mode.
- [x] Run `npm run test:unit -- AuthActions`; expected failure: actions, token store, and client are absent.
- [x] Implement the ports, actions, and `ApiClient` with an `AbortController` timeout; redact authorization headers from error objects and logs.
- [x] Implement `SecureTokenStore` as the only module importing `@aparajita/capacitor-secure-storage`; use one constant key `cue_cards.sanctum_token`.
- [x] Write the login component test first for email/password/device name, loading state, invalid-credential message, offline/local-only explanation, and password non-persistence.
- [x] Run the focused component test; expected failure: login view/store are absent.
- [x] Implement the login view/store and route guard: authenticated users enter the library, signed-out users can authenticate, and an expired server token never blocks already persisted scripts or recording routes.
- [x] Run API contract/auth tests, mobile auth/component tests, generated-contract drift check, typecheck, production build, and Android debug build.
- [x] Update the development log and commit: `feat: add versioned API contract and secure mobile auth`.

## Task 9: Process idempotent sync commands on Laravel

**Files:**

- Create: `apps/api/app/Domain/Scripts/ScriptSnapshot.php`
- Create: `apps/api/app/Domain/Scripts/ContentHash.php`
- Create: `apps/api/app/Application/Sync/SubmitSyncCommands.php`
- Create: `apps/api/app/Application/Sync/ApplyScriptSnapshot.php`
- Create: `apps/api/app/Application/Sync/GetSyncChanges.php`
- Create: `apps/api/app/Application/Sync/SyncConflict.php`
- Create: `apps/api/app/Http/Controllers/Api/V1/SyncController.php`
- Create: `apps/api/app/Http/Requests/Api/V1/SubmitSyncCommandsRequest.php`
- Create: `apps/api/app/Http/Resources/Api/V1/SyncChangeResource.php`
- Create: `apps/api/app/Models/SyncOperation.php`
- Create: `apps/api/app/Models/SyncChange.php`
- Create: `apps/api/database/migrations/2026_08_05_000005_create_sync_operations_table.php`
- Create: `apps/api/database/migrations/2026_08_05_000006_create_sync_changes_table.php`
- Modify: `apps/api/routes/api.php`
- Create: `apps/api/tests/Unit/Scripts/ScriptSnapshotTest.php`
- Create: `apps/api/tests/Integration/Sync/SubmitSyncCommandsTest.php`
- Create: `apps/api/tests/Feature/Api/V1/SyncApiTest.php`

**Interfaces:**

- Produces `SubmitSyncCommands::handle(User $user, array $commands): SyncBatchResult`.
- Produces `ApplyScriptSnapshot::handle(User $user, SyncCommand $command): AppliedChange` in one database transaction.
- Produces `GetSyncChanges::handle(User $user, int $afterCursor, int $limit): SyncPage`.
- Consumes commands shaped as `{ operation_id, aggregate_id, type: "script.replace", base_version, payload, created_at }`.

- [x] Write `ScriptSnapshotTest` first for UUID ownership, contiguous card positions, 3–5 cue validation when ready, matching script/card IDs, duplicate IDs, content hashes, and soft-delete snapshots.
- [x] Run `php artisan test --filter=ScriptSnapshotTest`; expected failure: snapshot DTO and domain validation are missing.
- [x] Implement immutable validated DTOs using Laravel validation only at the HTTP boundary and explicit domain exceptions inside the application layer.
- [x] Add `sync_operations` with globally unique `operation_id`, `user_id`, aggregate ID, result version, and timestamps; add append-only `sync_changes` with auto-increment cursor, user ID, aggregate ID, version, type, and snapshot JSON.
- [x] Write integration tests first for first apply, exact retry idempotency, two operations in request order, transaction rollback, ownership denial, stale `base_version`, and a successful soft delete.
- [x] Run `php artisan test --filter=SubmitSyncCommandsTest`; expected failure: sync actions and tables are missing.
- [x] Implement `ApplyScriptSnapshot` with `DB::transaction`, `lockForUpdate`, Eloquent persistence, one version increment, idempotency lookup, and one change-feed append.
- [x] Return `SyncConflict` before modifying rows when `base_version` differs. Include the submitted local snapshot and current server snapshot in the application result, but never write the losing snapshot.
- [x] Write API tests first for cursor pagination scoped to the authenticated user, maximum batch size 20, maximum snapshot size, duplicate operation response, and 409 error shape.
- [x] Run the focused API tests; expected failure: routes/controller/request/resource are missing.
- [x] Implement `POST /api/v1/sync/commands` and `GET /api/v1/sync?after={cursor}&limit={limit}` through thin request/controller/resource classes and update OpenAPI/generated types.
- [x] Add rate limiting keyed by user ID, payload limits, a correlation ID middleware, and structured logs containing only operation IDs, aggregate IDs, versions, and outcome.
- [x] Run sync unit/feature/integration tests against SQLite and PostgreSQL, full API suite, Pint, and OpenAPI drift check.
- [x] Update the development log and commit: `feat(api): add idempotent aggregate synchronization`.

## Task 10: Run the mobile outbox and resolve sync conflicts explicitly

**Files:**

- Create: `apps/mobile/src/application/ports/Connectivity.ts`
- Create: `apps/mobile/src/application/ports/SyncGateway.ts`
- Create: `apps/mobile/src/application/sync/RunSync.ts`
- Create: `apps/mobile/src/application/sync/ApplyRemoteChanges.ts`
- Create: `apps/mobile/src/application/sync/ResolveConflict.ts`
- Create: `apps/mobile/src/infrastructure/api/HttpSyncGateway.ts`
- Create: `apps/mobile/src/infrastructure/capacitor/CapacitorConnectivity.ts`
- Create: `apps/mobile/src/features/sync/sync.store.ts`
- Create: `apps/mobile/src/features/sync/components/SyncStatusBanner.vue`
- Create: `apps/mobile/src/features/sync/ConflictResolutionView.vue`
- Create: `apps/mobile/tests/integration/sync/RunSync.test.ts`
- Create: `apps/mobile/tests/unit/sync/ResolveConflict.test.ts`
- Create: `apps/mobile/src/features/sync/__tests__/ConflictResolutionView.test.ts`

**Interfaces:**

- Produces `SyncGateway.submit(commands: readonly OutboxCommand[]): Promise<SyncBatchResponse>` and `changes(after: number): Promise<SyncPage>`.
- Produces `RunSync.execute(reason: 'startup' | 'connectivity' | 'manual'): Promise<SyncResult>`.
- Produces `ResolveConflict.useServer(conflictId: string): Promise<void>` and `duplicateLocal(conflictId: string): Promise<string>`.
- Consumes `Connectivity.current(): Promise<boolean>` and `subscribe(listener: (online: boolean) => void): Unsubscribe`.

- [x] Write `RunSync.test.ts` first for offline no-op, FIFO upload, acknowledgement only after server acceptance, cursor download, duplicate operation acceptance, exponential retry metadata, token expiry, and app restart with a persisted outbox.
- [x] Add an offline-edit test where five saves of one aggregate collapse to one pending command; add an in-flight race test where a sixth save creates one pending successor and rebases it to the acknowledged server version before upload.
- [x] Add a race test where local text changes while an older remote AI result downloads; the older result must not replace the current full text or fresh cue state.
- [x] Run `npm run test:unit -- RunSync`; expected failure: gateway, action, and sync state are absent.
- [x] Implement `HttpSyncGateway` from generated OpenAPI types and `RunSync` with one process-wide mutex so startup, connectivity, and manual triggers cannot overlap.
- [x] Upload at most one command per aggregate at a time. After acknowledgement, update the local aggregate server version and rebase its pending successor in the same SQLite transaction before selecting the next command.
- [x] Apply downloads inside SQLite transactions and persist the cursor only after every change in the page succeeds.
- [x] Use bounded retry delays of 2, 5, 15, 30, and 60 seconds with jitter; stop automatic retry on 401 or 409 and expose an explicit state to the UI.
- [x] Write conflict use-case tests first: accepting server replaces local aggregate and clears its conflicting command; duplicating local assigns new UUIDv7 IDs to script/cards/cue sets, resets versions, and enqueues the duplicate without losing either copy.
- [x] Run `npm run test:unit -- ResolveConflict`; expected failure: conflict repository/actions are absent.
- [x] Implement persistent conflict records in SQLite by adding migration `002_sync_conflicts.ts`; store both snapshots and never silently pick a winner.
- [x] Write the conflict component test first for side-by-side titles/update times, clear Server copy and Save local as copy actions, and navigation back to both resulting scripts.
- [x] Implement the conflict view and global sync banner with `offline`, `syncing`, `up-to-date`, `retrying`, `auth-required`, and `conflict` states.
- [x] Subscribe on app bootstrap to Capacitor Network and App resume, but make all triggers call the same `RunSync` action.
- [x] Run focused sync tests, complete mobile suite, typecheck, build, and an Android offline/online smoke run.
- [x] Update the development log and commit: `feat(mobile): synchronize offline changes and surface conflicts`.

## Task 11: Generate structured AI cues, account usage, and preserve source text

**Files:**

- Create: `apps/api/app/Domain/AiAssistance/GenerationStatus.php`
- Create: `apps/api/app/Domain/AiAssistance/CueGenerationRequest.php`
- Create: `apps/api/app/Domain/AiAssistance/CueGenerationResult.php`
- Create: `apps/api/app/Application/AiAssistance/CueGenerator.php`
- Create: `apps/api/app/Application/AiAssistance/StartScriptCueGeneration.php`
- Create: `apps/api/app/Application/AiAssistance/StartCardCueGeneration.php`
- Create: `apps/api/app/Application/AiAssistance/CompleteCueGeneration.php`
- Create: `apps/api/app/Application/Usage/RecordAiUsage.php`
- Create: `apps/api/app/Infrastructure/Ai/CueCardsAgent.php`
- Create: `apps/api/app/Infrastructure/Ai/LaravelAiCueGenerator.php`
- Create: `apps/api/app/Jobs/GenerateScriptCues.php`
- Create: `apps/api/app/Http/Controllers/Api/V1/AiGenerationController.php`
- Create: `apps/api/app/Http/Resources/Api/V1/AiGenerationResource.php`
- Create: `apps/api/app/Models/AiGeneration.php`
- Create: `apps/api/database/migrations/2026_08_05_000007_create_ai_generations_table.php`
- Create: `apps/api/config/cue-cards.php`
- Modify: `apps/api/config/ai.php`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/routes/api.php`
- Create: `apps/api/tests/Unit/AiAssistance/CueGenerationResultTest.php`
- Create: `apps/api/tests/Feature/Api/V1/AiGenerationApiTest.php`
- Create: `apps/api/tests/Integration/AiAssistance/GenerateScriptCuesTest.php`

**Interfaces:**

- Produces `CueGenerator::generate(CueGenerationRequest $request): CueGenerationResult`.
- Produces `StartScriptCueGeneration::handle(User $user, Script $script): AiGeneration` and the card equivalent.
- Produces `CompleteCueGeneration::handle(AiGeneration $generation, CueGenerationResult $result): void`.
- Produces `POST /api/v1/scripts/{script}/cue-generations`, `POST /api/v1/cards/{card}/cue-generations`, and `GET /api/v1/ai-generations/{generation}`.
- Consumes Laravel AI SDK `Agent`, `HasStructuredOutput`, `Promptable`, `Lab::DeepSeek`, and Laravel Queue.

- [x] Add `ai_generations` with UUID, user/script/card IDs, provider, model, prompt version, source hashes, status, attempts, provider request ID, input/output tokens, nullable cost minor units, normalized safe error fields, and timing columns.
- [x] Write `CueGenerationResultTest` first: every expected card appears exactly once, unknown IDs are rejected, each card has 3–5 trimmed strings, duplicates/overlong cues are rejected, and source hashes are mandatory.
- [x] Run `php artisan test --filter=CueGenerationResultTest`; expected failure: request/result value objects are missing.
- [x] Implement immutable request/result objects and the `CueGenerator` port before importing Laravel AI SDK anywhere outside `Infrastructure/Ai`.
- [x] Create `CueCardsAgent` implementing `Agent` and `HasStructuredOutput`; define an array-of-objects schema with `card_id` and `cues`, and instructions requiring concise Russian prompts that summarize only the provided source.

```php
public function schema(JsonSchema $schema): array
{
    return [
        'cards' => $schema->array()->items(
            $schema->object(fn (JsonSchema $item): array => [
                'card_id' => $item->string()->required(),
                'cues' => $item->array()->items($item->string())->required(),
            ])
        )->required(),
    ];
}
```

- [x] Implement `LaravelAiCueGenerator` using `(new CueCardsAgent)->prompt($prompt, provider: Lab::DeepSeek, model: config('cue-cards.ai.model'), timeout: 90)` and convert the array-like structured response into the validated domain result.
- [x] Put `DEEPSEEK_API_KEY`, optional `DEEPSEEK_URL`, `CUE_CARDS_AI_MODEL`, maximum prompt bytes, maximum cue length, and prompt version in server configuration only.
- [x] Write API tests first: owner/superadmin can start generation, another user gets 404, full entitlement bypasses commercial quota, technical rate limiting still applies, and no AI key/model secret appears in the response.
- [x] Run `php artisan test --filter=AiGenerationApiTest`; expected failure: actions, endpoints, and queue dispatch are absent.
- [x] Implement start actions, policies, endpoints, and queue dispatch. Mark selected cue sets `pending` in the same transaction as the generation row.
- [x] Write queue integration tests first with a fake `CueGenerator`: success, deterministic batching, three attempts with backoff, final failure, content changed during generation, manually edited cues, token accounting, and provider exception sanitization.
- [x] Run `php artisan test --filter=GenerateScriptCuesTest`; expected failure: job/completion action/usage recorder are absent.
- [x] Implement `GenerateScriptCues` with `$tries = 3`, explicit backoff, correlation/generation IDs, safe exception mapping, and delegation to `CompleteCueGeneration`.
- [x] In `CompleteCueGeneration`, update a cue set only when its current content hash equals the captured source hash and it was not manually edited; otherwise preserve cues and mark stale. Never write `cards.full_text` from an AI result.
- [x] Commit accepted cue changes, one script aggregate version increment, and one `sync_changes` snapshot in the same server transaction so mobile clients receive AI results through the ordinary change feed.
- [x] Record usage for every completed or failed provider call, including superadmin calls. Do not decrement or check a commercial quota for superadmin.
- [x] Add database-queue migrations/configuration, run the worker with `php artisan queue:work --queue=ai --tries=3`, and document the production supervisor command without adding Redis.
- [x] Update OpenAPI and generated mobile types, then run all AI/API tests, full API suite, Pint, PostgreSQL CI, and contract drift check.
- [x] Update the development log and commit: `feat(api): generate and meter structured AI cues`.

## Task 12: Expose AI generation and editable cues in the mobile workflow

**Files:**

- Create: `apps/mobile/src/application/ports/AiGenerationGateway.ts`
- Create: `apps/mobile/src/application/ai/StartScriptCueGeneration.ts`
- Create: `apps/mobile/src/application/ai/StartCardCueGeneration.ts`
- Create: `apps/mobile/src/application/ai/RefreshGeneration.ts`
- Create: `apps/mobile/src/infrastructure/api/HttpAiGenerationGateway.ts`
- Create: `apps/mobile/src/features/ai-cues/aiCues.store.ts`
- Create: `apps/mobile/src/features/ai-cues/components/GenerationProgress.vue`
- Create: `apps/mobile/src/features/ai-cues/components/RegenerateCardButton.vue`
- Modify: `apps/mobile/src/features/import/ImportPreviewView.vue`
- Modify: `apps/mobile/src/features/editor/ScriptEditorView.vue`
- Modify: `apps/mobile/src/features/editor/components/CueListEditor.vue`
- Create: `apps/mobile/tests/unit/ai/GenerationActions.test.ts`
- Create: `apps/mobile/src/features/ai-cues/__tests__/GenerationProgress.test.ts`

**Interfaces:**

- Produces `AiGenerationGateway.startScript(scriptId: string): Promise<AiGeneration>` and `startCard(cardId: string): Promise<AiGeneration>`.
- Produces `RefreshGeneration.execute(generationId: string): Promise<AiGeneration>` and invokes sync when the server reaches a terminal state.
- Consumes generated OpenAPI types, `RunSync`, local repositories, and connectivity; components never poll HTTP directly.

- [x] Write generation action tests first: offline requests become locally pending, online requests sync first, a server generation is tracked by ID, completion triggers sync, stale results remain stale, and auth failure keeps the full script usable.
- [x] Run `npm run test:unit -- GenerationActions`; expected failure: AI gateway/actions are absent.
- [x] Implement the gateway and actions with one active poll per generation, 2/5/10-second intervals, cancellation on route disposal, and a manual Refresh action.
- [x] Use local cue statuses as the UI source of truth; server generation status augments progress but cannot replace locally edited cues.
- [x] Write `GenerationProgress.test.ts` first for `pending`, `generating 2/5`, `ready`, `stale`, `failed`, offline waiting, retry, and superadmin unrestricted messaging without a quota counter.
- [x] Run the focused component test; expected failure: progress components are absent.
- [x] Implement progress and regenerate controls. Require explicit confirmation before regenerating manually edited cues and preserve the previous cues until a valid replacement arrives.
- [x] Add import actions `Сохранить и создать тезисы` and `Сохранить без ИИ`; the first must save locally before attempting sync/generation.
- [x] Add whole-script generation to the editor and single-card regeneration beside each cue editor; expose errors as safe localized messages with Retry.
- [x] Add a recording fallback: cards without ready cues default to full-text mode, while the user can still choose stale/manual cues explicitly.
- [x] Run AI/mobile tests, all mobile tests, typecheck, production build, contract drift, and Android debug build.
- [x] Update the development log and commit: `feat(mobile): add AI cue generation workflow`.

## Task 13: Add end-to-end, accessibility, privacy, and failure-path hardening

**Files:**

- Create: `apps/mobile/playwright.config.ts`
- Create: `apps/mobile/tests/e2e/fixtures/fakeBackend.ts`
- Create: `apps/mobile/tests/e2e/youtube-script-flow.spec.ts`
- Create: `apps/mobile/tests/e2e/offline-recovery.spec.ts`
- Create: `apps/mobile/tests/e2e/accessibility.spec.ts`
- Create: `apps/mobile/src/shared/errors/AppError.ts`
- Create: `apps/mobile/src/shared/logging/SafeLogger.ts`
- Create: `apps/api/app/Http/Middleware/CorrelationId.php`
- Create: `apps/api/app/Support/SafeContext.php`
- Create: `apps/api/tests/Feature/Privacy/LogRedactionTest.php`
- Create: `apps/api/tests/Feature/Api/V1/TechnicalSafeguardsTest.php`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**

- Produces `SafeLogger.info(event: string, context: SafeLogContext): void` with an allowlisted context type.
- Produces `SafeContext::fromRequest(Request $request): array` containing only correlation ID, user ID, operation ID, generation ID, route, and outcome.
- Consumes fake API and in-memory adapters only in Playwright; production composition remains SQLite/Capacitor/API based.

- [x] Configure Playwright with a deterministic fake backend, web-compatible in-memory repositories, Chromium mobile viewport, reduced motion, and trace-on-first-retry.
- [x] Write the full journey test first: login → import synthetic Markdown → correct preview → save → fake-generate 3–5 cues → edit/reorder → record → switch cue/full → force offline → edit → reconnect → sync.
- [x] Run `npm run test:e2e -- youtube-script-flow`; expected failure must identify the first missing integration behavior, then fix only wiring defects without weakening assertions.
- [x] Write offline recovery first: preload SQLite-compatible state, reload the app, recover recording position and outbox, receive 409, duplicate local copy, and verify both copies remain visible.
- [x] Run the focused offline test to red, correct composition/persistence wiring, then rerun it to green.
- [x] Write accessibility checks for visible keyboard focus, accessible names, 48×48 touch targets, no horizontal overflow at 320 px, font scale 1.4, and computed contrast of every semantic surface/foreground token pair in both themes.
- [x] Run the accessibility test to red on any violation; fix tokens/components rather than excluding selectors.
- [x] Write `LogRedactionTest` first with sentinel script text, password, bearer token, and AI key; exercise login, sync failure, and AI failure, then assert none of the sentinels appears in captured logs.
- [x] Run `php artisan test --filter=LogRedactionTest`; expected failure: unrestricted request context reaches logs.
- [x] Implement correlation middleware, allowlisted `SafeContext`, and mobile `SafeLogger`; remove raw exception/request serialization from application logs.
- [x] Write technical-safeguard tests for login throttling, AI rate limiting, 1 MiB import/API payload policy, sync batch 20, generation timeout, and three-attempt cap; assert superadmin bypasses only commercial entitlements.
- [x] Run focused safeguard tests, then full API and mobile suites.
- [x] Add CI jobs for OpenAPI drift, Playwright, PostgreSQL parity, and Gradle unit/debug assembly; upload test reports and debug APK only on CI failure or tagged builds.
- [x] Run the exact clean verification matrix documented in README and record commands, counts, and outcomes in the development log.
- [x] Commit: `test: harden end-to-end offline and privacy behavior`.

## Task 14: Deploy the personal demo Laravel API

Task 14 is intentionally reduced to the owner's personal demo. Production-scale backup automation, restore drills, protected-environment approvals, dedicated deploy users, and exhaustive deployment verification are deferred until the owner has evaluated the installed APK.

**Demo defaults:**

- Existing deployment pattern: `/Users/dmitriypur/Desktop/LARAVEL_PROJECTS/entrepreneur-platform/.github/workflows/deploy.yml`.
- API domain: `cue-cards.web-func.ru`.
- Repository path: `/var/www/cue-cards-api`.
- Laravel root: `/var/www/cue-cards-api/apps/api`.
- SSH deployment user: `root`, matching the existing application.
- Runtime user: `www-data`; PHP-FPM: `php8.3-fpm`; queue: database queue `ai`.

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `docs/API_DEPLOYMENT.md`
- Modify: `docs/tasks/014-current-task.md`
- Modify: `README.md`
- Modify: `docs/DEVELOPMENT_LOG.md`

- [x] Create branch/worktree `codex/task-014-production-api-deploy`.
- [x] Add a direct GitHub SSH deploy job for every push to `main`; it does not wait for CI jobs and does not build the mobile client on the server.
- [x] Deploy with `git fetch/reset`, production Composer install, `migrate --force`, Laravel caches, runtime permissions, PHP-FPM/worker restart, Nginx validation/reload, and HTTPS `/up` smoke.
- [x] Document minimal GitHub secrets, server checkout, PostgreSQL, `.env`, Nginx TLS, Supervisor worker, and one-time superadmin setup.
- [ ] Create/connect the GitHub repository and configure `HOST`, `PORT`, `USERNAME`, `SSH_KEY`, `APP_DIR`, and `API_BASE_URL`.
- [ ] Provision the server, push `main`, and verify `/up`, login, sync, and one AI generation without printing credentials or tokens.
- [ ] Commit and merge Task 14, then start Task 15 for the owner's APK.
- [ ] Commit: `build(api): add demo deployment workflow`.

## Task 15: Produce and verify the signed Android release APK

**Files:**

- Create: `apps/mobile/android/key.properties.example`
- Modify: `apps/mobile/android/app/build.gradle`
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- Create: `apps/mobile/scripts/verify-release-config.mjs`
- Create: `apps/mobile/tests/unit/release/verifyReleaseConfig.test.ts`
- Create: `docs/ANDROID_RELEASE.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**

- Produces `npm run android:release` that validates configuration, builds web assets, syncs Capacitor, and calls Gradle `assembleRelease`.
- Produces a signed `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` for manual installation.
- Consumes the Task 14 production API through `VITE_API_BASE_URL=https://cue-cards.web-func.ru`; release builds must fail when the HTTPS API URL is absent or invalid.
- Consumes a user-created keystore path and passwords from untracked `key.properties` or protected CI secrets; it never creates or commits credentials automatically.

- [ ] Write `verifyReleaseConfig.test.ts` first for missing file, missing key alias, nonexistent keystore, debug keystore rejection, and a syntactically valid external release configuration.
- [ ] Run `npm run test:unit -- verifyReleaseConfig`; expected failure: validation script is absent.
- [ ] Implement `verify-release-config.mjs` to read explicit `CUE_CARDS_KEY_PROPERTIES` or `android/key.properties`, validate required keys, and print only safe field names—not paths or passwords.
- [ ] Add `key.properties.example` with non-secret field names `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`; keep actual files and keystores ignored.
- [ ] Configure Gradle release signing only when validation succeeds, enable release minification/resource shrinking, and retain Capacitor/plugin classes required by the installed dependencies.
- [ ] Limit Android manifest permissions to network state and those actually required by selected plugins; do not request broad storage access for Android versions where the system document picker grants URI access.
- [ ] Document an explicit one-time keystore command using a path outside the repository, backup requirements, SHA-256 checksum recording, local `key.properties`, build, `apksigner verify --verbose --print-certs`, and `adb install -r`.
- [ ] Add a protected manual/tagged CI release job that reads base64 keystore and passwords from CI secrets, requires the Task 14 production `API_BASE_URL`, builds the APK, verifies its certificate, and uploads the APK plus SHA-256 checksum; never run this job for pull requests.
- [ ] Run the complete API/mobile/contract/E2E matrix, then `npm run android:release` and `apksigner verify --verbose --print-certs` against the produced APK.
- [ ] Install with `adb install -r`, log in once, import the synthetic fixture, generate fake or staging cues, force-stop with `adb shell am force-stop app.cuecards.mobile`, disable network, relaunch, and verify library plus recording position remain available.
- [ ] Re-enable network, verify queued changes sync once, and inspect server/mobile logs to confirm no script text or secrets were emitted.
- [ ] Record the APK path, SHA-256 checksum, application ID, version code/name, signing certificate SHA-256, device/Android version, and smoke result in a private release record; only the non-secret procedure belongs in Git.
- [ ] Complete `docs/tasks/015-current-task.md`, finalize the development log with no active implementation task, and commit: `build(android): add reproducible signed APK release`.

## Final Acceptance Matrix

- [ ] Fresh checkout installation succeeds from documented Composer/npm commands.
- [ ] Production API deploys from a successful `main` CI run, serves `/up` and `/api/v1/*` over trusted HTTPS, and reports the intended commit with `APP_DEBUG=false`.
- [ ] Production PostgreSQL backup retention and a separate restore drill pass before migrations; application rollback is demonstrated without `migrate:rollback`.
- [ ] The supervised database worker consumes queue `ai`, completes one synthetic generation, and restarts cleanly after deployment.
- [ ] API PHPUnit suite passes on SQLite and PostgreSQL; Pint reports no changes.
- [ ] Mobile unit/component/integration suites, strict typecheck, Vite production build, and Playwright journeys pass.
- [ ] OpenAPI regeneration is clean and every implemented API route is represented.
- [ ] Android Gradle unit tests, debug assembly, signed release assembly, signature verification, install, update, force-stop, and offline relaunch pass.
- [ ] The signed release APK is built with the verified Task 14 HTTPS `VITE_API_BASE_URL` and completes login, sync, AI, reconnect, and conflict smoke tests against production.
- [ ] Import handles approved Markdown and TXT behavior with synthetic Cyrillic fixtures and a correctable preview.
- [ ] Editor, cues, recording position, and outbox survive process restart without network.
- [ ] Sync retries are idempotent and every version conflict preserves both local and server data until an explicit choice.
- [ ] AI produces validated 3–5 cue arrays, never changes full text, respects hashes/manual edits, retries safely, and records usage.
- [ ] The creator account is server-side `superadmin`, sees every implemented feature, has no commercial AI quota, and still receives technical safety protections.
- [ ] Light/dark surfaces meet contrast checks; no light tile renders white body text; recording controls meet touch-target and font-scale checks.
- [ ] Logs, Git history, APK contents, and generated artifacts contain no user source document, access token, AI key, signing key, or keystore password.
- [ ] `git status --short` is clean and `docs/DEVELOPMENT_LOG.md` contains the final command evidence.

## Explicitly Deferred Follow-up Plans

- Filament server administration for users, roles, usage, and generation failures.
- Invitations, ordinary-user entitlements, Free/Creator/Studio plans, Google Play Billing, and web billing.
- Public registration, password recovery, analytics, multi-device UX refinements, iOS, and Play Store/AAB publication.
- Learning, conversation, and presentation workflows built as new modules over shared document/section/cue concepts.

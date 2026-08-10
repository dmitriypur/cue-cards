# AI Sync and Layout Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent AI generation from creating an avoidable version conflict and keep the global Android sync banner from shifting the page vertically.

**Architecture:** Generation start performs a second ordinary sync after the server accepts the job, so the local aggregate receives the server-authored version before further edits. Editor refreshes use a new read-only application action instead of the existing open/touch action. The sync banner becomes a stable one-row grid with a 64-pixel minimum height.

**Tech Stack:** Vue 3, strict TypeScript, Pinia, Tailwind CSS, Vitest, Capacitor 8, Android Gradle.

## Global Constraints

- Every user edit remains committed to SQLite before network work.
- Full script text is never replaced or deleted by an AI response.
- Genuine conflicts remain explicit; no automatic server/local choice is added.
- Actual credentials, access tokens, AI keys, signing keys, and keystore passwords are never logged or committed.
- Run focused suites only, followed by typecheck, production build, signed APK assembly, and signature verification.

---

### Task 1: Synchronize the server-authored generation version

**Files:**
- Modify: `apps/mobile/tests/unit/ai/GenerationActions.test.ts`
- Modify: `apps/mobile/src/application/ai/StartScriptCueGeneration.ts`
- Modify: `apps/mobile/src/application/ai/StartCardCueGeneration.ts`

**Interfaces:**
- Consumes: `ManualSync.execute('manual'): Promise<SyncResult>`.
- Produces: generation start ordering `save -> sync -> start -> markStarted -> sync`.

- [x] Add failing assertions that online script/card starts invoke two syncs with the server start between them.
- [x] Add failing cases mapping post-start `retrying`, `auth-required`, and `conflict` to existing safe result states while retaining `generationId` in the durable request.
- [x] Run `npm run test:unit -- GenerationActions` and confirm failures show the missing post-start sync.
- [x] Add a shared private result mapper in each start action and run the second manual sync after `markStarted`.
- [x] Rerun `npm run test:unit -- GenerationActions` and confirm green.

### Task 2: Refresh editor data without creating an outbox command

**Files:**
- Create: `apps/mobile/src/application/scripts/ReadScript.ts`
- Modify: `apps/mobile/src/features/editor/editor.dependencies.ts`
- Modify: `apps/mobile/src/features/editor/editor.store.ts`
- Modify: `apps/mobile/src/features/editor/ScriptEditorView.vue`
- Modify: `apps/mobile/src/app/bootstrap.ts`
- Modify: `apps/mobile/src/features/editor/__tests__/ScriptEditorView.test.ts`
- Modify: `apps/mobile/tests/unit/library/LibraryActions.test.ts`

**Interfaces:**
- Produces: `ReadScript.execute(scriptId: UUID): Promise<ScriptAggregate>` with no persistence side effect.
- Produces: `EditorDependencies.readScript: ScriptLoader` and `editorStore.refresh()`.

- [x] Add a failing `ReadScript` test proving the aggregate is returned without calling repository `save`, plus missing/deleted rejection.
- [x] Add a failing editor test proving initial mount uses `getScript`, while generation-start and terminal refreshes use `readScript` and do not call `getScript` again.
- [x] Run `npm run test:unit -- LibraryActions ScriptEditorView` and confirm the intended failures.
- [x] Implement `ReadScript`, wire it in native and E2E composition, and add `editorStore.refresh`.
- [x] Replace post-generation `store.load` calls with `store.refresh`, retaining `store.load` on initial mount.
- [x] Rerun the focused tests and strict `npm run typecheck`.

### Task 3: Stabilize the synchronization banner height

**Files:**
- Modify: `apps/mobile/src/features/sync/components/SyncStatusBanner.vue`
- Modify: `apps/mobile/src/features/sync/__tests__/ConflictResolutionView.test.ts`

**Interfaces:**
- Preserves all existing actions and accessible status labels.
- Produces a single-row `min-h-16` grid with `grid-cols-[minmax(0,1fr)_auto]`.

- [x] Add a failing component assertion for the stable grid/minimum-height contract across `syncing` and `up-to-date`.
- [x] Run `npm run test:unit -- ConflictResolutionView` and confirm RED.
- [x] Apply the stable grid layout and remove margin-based button placement in favor of grid gap.
- [x] Rerun the focused component test and `npm run typecheck`.

### Task 4: Release verification and handoff

**Files:**
- Modify: `docs/tasks/016-current-task.md`
- Modify: `docs/DEVELOPMENT_LOG.md`

**Interfaces:**
- Produces a signed update APK for `app.cuecards.mobile`, version code 1/name 1.0, using the existing private signing material.

- [x] Run the focused tests, `npm run typecheck`, and `npm run build` with the production API URL.
- [x] Run `npm run android:release` with external signing properties and the production API URL.
- [x] Verify embedded production URL, package metadata, `apksigner verify --verbose --print-certs`, and SHA-256.
- [x] Check `adb devices`; install with `adb install -r` only if connected.
- [x] Record exact evidence in Task 16 and the development log, inspect `git status --short`, and commit the implementation.
- [ ] Merge `codex/task-016-sync-generation-stability` into `main`, push, wait for the exact-SHA GitHub deploy, and provide the APK path plus one-time existing-conflict instruction.

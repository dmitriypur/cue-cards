# Cue Cards AI sync and layout stability design

Date: 2026-08-10  
Status: approved for implementation

## Problem evidence

The production generation completed successfully for all 10 cards, but the Android client persisted a conflict and stopped downloading the ready cues. The server's latest script is version 3 with one completed generation and 10 `ready` cue sets.

The false conflict is caused by a version gap around AI start. The client first uploads its local `pending` cue state, then the server starts a generation and advances the aggregate version. Before the client downloads that server-authored version, the editor reload path records another local aggregate snapshot against the older base version. The next upload correctly receives HTTP 409, but this is an avoidable client ordering defect rather than a meaningful content conflict.

The vertical screen jump comes from `SyncStatusBanner`: `syncing` renders no 48-pixel action button, while stable/error states render one. Every automatic sync therefore changes the banner height and moves the full page.

## Required behavior

1. Starting whole-script or one-card generation remains offline-first: local pending state and the durable generation request are committed before network work.
2. After the server accepts a generation, the client immediately runs ordinary sync again and ingests the server-authored aggregate version before returning control to editing.
3. Reloading editor data after an AI action reads the local repository without touching `lastOpenedAt` or creating an outbox command. Initial user navigation may continue recording `lastOpenedAt` through the existing open action.
4. Genuine HTTP 409 conflicts remain explicit and are never silently resolved.
5. The already persisted production conflict is resolved once by selecting the server version, which contains the completed 10/10 cue sets. The update must not silently choose for the user.
6. The global synchronization banner keeps a stable minimum 64-pixel row across `syncing`, `up-to-date`, offline, retry, authentication, and conflict states. Its status text may wrap inside the text column without moving the action to a new row.
7. Full script text remains untouched by AI responses and by conflict handling.

## Design

Add a side-effect-free local script read action for editor refreshes. `ScriptEditorView` uses the existing open action only on mount and the read action after generation starts or reaches a terminal state.

Both generation-start actions use the same post-start synchronization helper: persist the generation ID first, run manual sync, and map the result to the existing safe UI states. A successful start is reported as tracking only after the server version has been downloaded. If connectivity or authentication is lost after the server accepted the job, the durable generation row remains resumable and the UI reports its existing waiting/auth state without duplicating the provider request.

Render `SyncStatusBanner` as a single-row two-column grid with `min-height: 4rem`; status text occupies `minmax(0, 1fr)` and the optional 48-pixel action occupies the auto column.

## Verification

- Unit RED/GREEN for script and card starts proving `save -> pre-start sync -> start -> mark started -> post-start sync`.
- Unit RED/GREEN for post-start retry/auth/conflict mapping with the durable generation ID retained.
- Editor component RED/GREEN proving post-generation refresh uses the read-only action and does not invoke the open/touch action.
- Sync banner component RED/GREEN proving the stable grid/min-height classes across status changes.
- Focused AI, editor, and sync-banner tests; strict TypeScript; production web build; signed release assembly and `apksigner` verification.
- Install over the existing package when an Android device is connected; otherwise publish the exact APK path and checksum.

## Scope exclusions

No server schema/API changes, silent conflict resolution, backup/restore work, Redis, Horizon, AAB/Play Store publishing, or unrelated editor-density redesign.

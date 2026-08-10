# Task 016 — AI sync ordering and stable Android layout

**Status:** Complete

## Outcome

Prevent AI-start version gaps from producing false conflicts, keep real conflicts explicit, stop the global sync banner from vertically shifting the Android screen, and ship an updated signed APK.

## Evidence and scope

- Production has one completed generation with 10/10 ready cue sets for the affected script.
- Root cause and approved design are recorded in `docs/superpowers/specs/2026-08-10-ai-sync-and-layout-stability-design.md`.
- Existing persisted conflict remains a one-time explicit server-version choice.
- No unrelated card-density redesign or server hardening is included.

## Progress

- [x] Reproduced the faulty version ordering from source and production-safe metadata.
- [x] Identified variable sync-banner height as the vertical layout shift.
- [x] Received owner approval for the proposed design.
- [x] Wrote and reviewed the implementation plan.
- [x] Implemented through focused RED/GREEN tests.
- [x] Built and verified the signed update APK. Merge/push evidence is recorded after integration.

## Implementation

- Script-level and card-level AI start now persist the accepted generation ID and immediately run a second ordinary sync. The server-authored aggregate version therefore arrives before later local commands.
- Editor generation refreshes use the side-effect-free `ReadScript` action. Initial opening still records `lastOpenedAt`, while polling/terminal refreshes no longer create an outbox command.
- Genuine synchronization conflicts remain explicit and require the existing local/server choice.
- The global synchronization banner now uses one stable `min-h-16` grid row, so action-button state changes do not shift the entire Android screen.

## Verification evidence

- Focused baseline: `npm run test:unit -- GenerationActions LibraryActions ScriptEditorView ConflictResolutionView` passed 29 tests before changes.
- AI ordering RED: `GenerationActions` produced 6 intended failures because the post-start sync was absent; GREEN passed 18/18.
- Read-only refresh RED: the missing `ReadScript` module and a repeated side-effecting `getScript` call failed as intended; GREEN passed 11/11.
- Banner RED: the stable `grid` / `min-h-16` contract was absent; combined GREEN passed 35 tests in 4 files.
- `npm run typecheck` passed with strict TypeScript.
- `env VITE_API_BASE_URL=https://cue-cards.web-func.ru npm run build` passed with 189 transformed modules.
- Signed `npm run android:release` passed Vite build, Capacitor sync, R8, Android lint, and `assembleRelease` with 360 executed tasks.
- `apksigner verify --verbose --print-certs` verified one RSA-4096 signer with APK Signature Scheme v2; signing material remained outside the repository and no credential was printed.
- APK metadata: `app.cuecards.mobile`, version code `1`, version name `1.0`; embedded origin is `https://cue-cards.web-func.ru`.
- APK SHA-256: `cb76d200274d11d1d91e3cb58578d8bf172507afc850d13550cecf1e25c65b73`.
- `adb devices -l` returned no connected device, so installation was not attempted.

The conflict already stored on the installed device is intentionally not auto-resolved. After installing the update over the existing app, choose the server version once; the production aggregate contains ready cues for all 10 cards.

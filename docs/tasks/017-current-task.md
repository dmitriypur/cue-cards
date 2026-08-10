# Task 017 — personal-demo visual polish

**Status:** Complete

## Outcome

Ship the owner's locally adjusted compact Android layout without changing application behavior.

## Scope

- Remove the redundant application header and reduce horizontal shell padding.
- Make the synchronization banner shorter while keeping its height stable across states.
- Let recording setup controls use the available width.
- Use more of the recording screen for content and remove excess content padding.
- Update only directly affected component contracts, run focused tests/typecheck/build, and produce a signed production-connected APK.

## Progress

- [x] Reviewed the owner's four modified Vue components.
- [x] Confirmed three focused tests failed only because they still described the previous layout.
- [x] Updated those component contracts to the approved local visual state.
- [x] Completed focused verification and produced the signed APK; integration evidence is recorded after merge/push.

## Verification evidence

- Focused pre-update component run reproduced 3 stale visual-contract failures: removed header, `min-h-12` banner, and `h-full` recording card.
- Updated only those contracts plus the full-width recording selector and removed content padding; `npm run test:unit -- RecordingView ConflictResolutionView AppShell` passed 17/17.
- `npm run typecheck` passed.
- `npm run android:release` passed strict build, Vite production build (189 modules), Capacitor sync, Android lint/R8, and `assembleRelease` (360 tasks; 352 executed, 8 up-to-date).
- `apksigner verify --verbose --print-certs` verified APK Signature Scheme v2 with the existing RSA-4096 personal-demo signer.
- APK metadata remains `app.cuecards.mobile`, version code `1`, version name `1.0`; the embedded origin is `https://cue-cards.web-func.ru`.
- APK size: 21,011,172 bytes. SHA-256: `5b92e21f7a0f99c32b4146a9c1497e8ddf71accd8ec49df7a2adbd00ea588657`.
- `adb devices -l` found no connected device, so installation was not attempted.

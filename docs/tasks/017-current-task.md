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
- [x] Completed focused verification and signed APK, merged as `1c48c81`, corrected the CI accessibility finding as `e80ad30`, and pushed to `main`.

## Verification evidence

- Focused pre-update component run reproduced 3 stale visual-contract failures: removed header, `min-h-12` banner, and `h-full` recording card.
- Updated only those contracts plus the full-width recording selector and removed content padding; `npm run test:unit -- RecordingView ConflictResolutionView AppShell` passed 17/17.
- `npm run typecheck` passed.
- The first CI/local E2E run caught a 44.8px sync action under enlarged text. Keeping the 48px banner, its actions now retain 48px minimum touch height; the complete `npm run test:e2e` run then passed 3/3.
- Final `npm run android:release` passed strict build, Vite production build (189 modules), Capacitor sync, Android lint/R8, and `assembleRelease` (360 tasks; 38 executed, 322 up-to-date).
- `apksigner verify --verbose --print-certs` verified APK Signature Scheme v2 with the existing RSA-4096 personal-demo signer.
- APK metadata remains `app.cuecards.mobile`, version code `1`, version name `1.0`; the embedded origin is `https://cue-cards.web-func.ru`.
- Final APK size: 21,011,164 bytes. SHA-256: `49f8161d51873476d172a5476d8db791f90e700e9909e0ff32f2a8dfbd68aa6d`.
- `adb devices -l` found no connected device, so installation was not attempted.
- GitHub Actions run `31420501146` passed all six jobs for exact SHA `e80ad3038f9e9ba27c4f31c9d424b63ce0eede7a`, including Mobile E2E and Deploy API; production HTTPS `/up` returned 200 afterward.

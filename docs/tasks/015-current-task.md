# Task 015 — signed Android personal demo APK

**Status:** Complete on `codex/task-015-android-release`

## Required outcome

Build a signed, installable release APK connected to `https://cue-cards.web-func.ru`, verify its build, signature, and production login, and install it when an Android device is connected.

## Scope

- Use signing material outside Git and never print its passwords or private key.
- Run only focused release validation, release assembly, signature verification, and production login smoke.
- Do not repeat Task 13/14 test matrices or add AAB/Play Store/public-release work.

## Progress

- [x] Task 14 production API and GitHub auto-deploy are complete.
- [x] Created `codex/task-015-android-release` from `main` at `7ce78da`.
- [x] Added the release configuration validator through RED/GREEN TDD (8 focused tests).
- [x] Embedded and verified `https://cue-cards.web-func.ru` in release assets.
- [x] Created private signing material outside Git and built the R8-shrunk signed APK.
- [x] Verified APK v2 signature, checksum, package metadata, and production login/me/logout with automatic smoke-user cleanup.
- [x] Checked ADB; no Android device was connected, so copied the APK to the main checkout for manual installation.
- [x] Record evidence, commit, merge into `main`, and push as the final Task 15 handoff.

## Verification evidence

- Focused RED: `npm run test:unit -- verifyReleaseConfig` failed because `build-android-release.mjs` was absent.
- Focused GREEN: the same command passed 8/8 tests.
- `npm run android:release` passed web build and Capacitor sync; the initial R8 pass exposed compile-time-only Tink annotations. After applying the exact generated `-dontwarn` rules, focused `./gradlew assembleRelease` completed 360 tasks successfully.
- `apksigner verify --verbose --print-certs` reports one RSA-4096 signer and APK Signature Scheme v2 verification.
- Package: `app.cuecards.mobile`, version code `1`, version name `1.0`; APK SHA-256 `d24b7e5c79e755acd4dde1bf615f53487997ae5525f796f4eee1eb8b8267c796`; signing certificate SHA-256 `6d1a782c2fca9bc60a1dac95d1da1c50ab03f131dddd4a15c73199691cdeaca1`.
- The production API returned 200 for login and `/me`, then 204 for logout. Credentials and token were never printed; the temporary superadmin and its cascaded data were removed.
- `adb devices` returned no connected devices. Manual install: `adb install -r /Users/dmitriypur/Desktop/LARAVEL_PROJECTS/cue-cards/apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

# Android personal demo release

The release APK is built against the production API and signed with material that remains outside Git.

## One-time signing setup

Create a private keystore and a `key.properties` file outside the repository. Use `apps/mobile/android/key.properties.example` only as a field-name reference. Keep both files mode `0600`, back them up privately, and never print or commit their passwords.

## Build

```bash
cd apps/mobile
export VITE_API_BASE_URL=https://cue-cards.web-func.ru
export CUE_CARDS_KEY_PROPERTIES=/absolute/private/path/key.properties
npm run android:release
```

The command rejects HTTP API origins, incomplete signing properties, missing keystores, and Android debug keys before building. Its output is `android/app/build/outputs/apk/release/app-release.apk`.

Verify and install with Android SDK tools:

```bash
apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

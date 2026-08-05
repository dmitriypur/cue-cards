# Cue Cards

Cue Cards is an offline-first Android application for turning Markdown or plain-text scripts into editable recording cards. This repository contains a Laravel JSON API and a Vue application packaged with Capacitor; Inertia and Filament are intentionally outside the MVP.

## Repository layout

- `apps/api` — Laravel 13 API, Sanctum authentication, database queue, and AI integration boundary.
- `apps/mobile` — Vue 3, Pinia, Vue Router, Tailwind CSS, shadcn-vue, and the Capacitor Android shell.
- `docs` — approved design, numbered implementation plan, current task, and verification log.

## Requirements

- PHP 8.3 and Composer 2
- Node.js 24 and npm 11
- Java 21, Android SDK, and the Android platform/build tools required by Capacitor 8

## Install

```bash
cd apps/api
composer install
cp .env.example .env
php artisan key:generate

cd ../mobile
npm ci
npm run build
npm run cap:sync
```

Set `JAVA_HOME` and `ANDROID_HOME` to the local JDK 21 and Android SDK locations before using Gradle. Keep API keys and signing material only in ignored local environment files.

## Verification

```bash
cd apps/api
php artisan test
./vendor/bin/pint --test

cd ../mobile
npm run test:unit
npm run typecheck
npm run build
npm run cap:sync

cd android
./gradlew testDebugUnitTest assembleDebug
```

End-to-end tests are available through `npm run test:e2e` once Task 13 adds browser journeys. The canonical API contract and generated client are added in later numbered tasks.

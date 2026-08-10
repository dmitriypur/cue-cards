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

## AI queue

AI cue generation uses the Laravel database queue. Configure `DEEPSEEK_API_KEY`, optional `DEEPSEEK_URL`, and `CUE_CARDS_AI_MODEL` only in the server `.env`, then run the dedicated worker:

```bash
cd apps/api
php artisan queue:work --queue=ai --tries=3 --timeout=100 --sleep=1
```

In production, supervise that exact command with the process working directory set to `apps/api`, automatic restart enabled, and graceful restarts performed with `php artisan queue:restart`. Redis and Horizon are not required for the MVP.

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

End-to-end browser journeys run through `npm run test:e2e`. The canonical API contract is `docs/api/openapi.yaml`; regenerate the committed mobile transport types with `npm run contract:generate` from `apps/mobile`.

The minimal personal/demo API server setup and GitHub auto-deploy are documented in [`docs/API_DEPLOYMENT.md`](docs/API_DEPLOYMENT.md).

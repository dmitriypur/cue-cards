# Cue Cards repository instructions

## Read before changing code

1. Read `docs/superpowers/specs/2026-08-05-cue-cards-youtube-mvp-design.md`.
2. Read `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.
3. Read the active file in `docs/tasks/` and update it as work progresses.
4. Record completed vertical increments and verification evidence in `docs/DEVELOPMENT_LOG.md`.

## Product invariants

- The Android client is offline-first: every user edit is committed to local SQLite before any network request.
- Full script text is never replaced or deleted by an AI response.
- AI cues contain 3–5 short non-empty strings and are applied only when `source_hash` equals the card's current `content_hash`.
- The initial account has the server-controlled role `superadmin`. It bypasses commercial paywalls and AI quotas, while technical safeguards and usage accounting remain active.
- User script text, passwords, access tokens, AI keys, signing keys, and keystore passwords must never be logged or committed.
- Personal source documents outside this repository must not be copied into fixtures. Use synthetic Cyrillic content.

## Architecture

- `apps/api`: Laravel 13 modular monolith, versioned JSON API, Sanctum, PostgreSQL in production, SQLite in automated tests, database queue.
- `apps/mobile`: Vue 3 SPA, strict TypeScript, Pinia, Vue Router, Tailwind CSS, shadcn-vue source components, Capacitor 8 Android shell.
- Mobile features depend on `domain` and `application` ports. Capacitor, SQLite, HTTP, and secure-storage details stay in `infrastructure` adapters.
- Laravel controllers validate HTTP input and invoke one application action. Policies own authorization; actions/services own business rules.
- Use portable Laravel migrations that work on PostgreSQL and SQLite. Do not add database-specific SQL without a tested abstraction.
- Inertia is intentionally not used because the UI must load from the APK without Laravel.
- Filament is intentionally deferred until a server administration UI is needed. Do not add it to the MVP.
- Redis, Horizon, billing, public registration, iOS, and Google Play publication are out of MVP scope.

## Development discipline

- Implement one numbered task from the detailed plan at a time.
- Use test-driven development: write the failing test, run it and confirm the intended failure, implement the minimum behavior, then rerun the focused and relevant full suites.
- Keep commits small and scoped to one coherent task. Never commit a failing test suite.
- After a numbered task is completed and committed on its task branch, merge that branch into `main` and verify the merge before starting the next task.
- TypeScript must pass strict type checking with no `any` escape hatches in application code.
- API contracts are defined in OpenAPI and generated into the mobile client; do not hand-maintain duplicate transport types.
- Prefer small domain methods and application actions over business logic in Vue components, Pinia stores, controllers, jobs, or Eloquent models.

## Verification commands after scaffolding

```bash
cd apps/api && php artisan test
cd apps/api && ./vendor/bin/pint --test
cd apps/mobile && npm run typecheck
cd apps/mobile && npm run test:unit
cd apps/mobile && npm run build
cd apps/mobile && npm run test:e2e
```

For Android-related changes also run:

```bash
cd apps/mobile && npm run cap:sync
cd apps/mobile/android && ./gradlew testDebugUnitTest assembleDebug
```

## Secrets and generated artifacts

- Keep `.env`, `.env.*.local`, Android keystores, `key.properties`, signing credentials, build outputs, SQLite databases, and AI provider secrets ignored.
- Commit Composer and npm lock files.
- Commit generated OpenAPI TypeScript types so API contract drift is visible in review.
- Before claiming completion, inspect `git status --short`, run the relevant test suites, and record the exact commands and results in the development log.

# Task 007 — Laravel identity, scripts, and superadmin access

**Status:** Complete

**Plan source:** Task 7 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Add the first server-side product slice: server-controlled roles and entitlements, closed Sanctum authentication, portable script/card/cue persistence, and ownership-protected script reads.

## Acceptance

- `superadmin` automatically receives every product entitlement while technical safeguards remain separate.
- Closed login issues a Sanctum token, `/me` returns the authenticated user and entitlements, and logout revokes only the current token.
- UUID-keyed script, card, and cue-set migrations work on SQLite and PostgreSQL and preserve deterministic card order.
- A seeded superadmin is configured only through environment values; no real credential is stored in the repository.
- Owners can read their active scripts; other users and soft-deleted scripts receive 404 without leaking nested data.
- Focused and full API suites, Pint, disposable SQLite migration/seeding, and PostgreSQL parity pass.

## Execution rule

Work through Task 7 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 8.

## Progress

- Confirmed Tasks 001–006 are complete from Git history, task checkpoints, and the development log.
- Created branch `codex/task-007-api-identity` from clean `main` at `75b9bbc`.

## Completion evidence

- `EntitlementServiceTest` RED failed on missing identity classes, then passed with automatic all-feature access for `superadmin`, explicit free features for normal users, and technical safeguards kept outside commercial entitlements.
- `AuthTest` RED returned 404 for missing `/api/v1` routes, then passed closed Sanctum login/logout, authenticated `/me`, token scoping, validation/authentication errors, safe 405/500 envelopes, and credential-field exclusion.
- `ScriptReadTest` RED kept the owner path at 404, then passed deterministic card/cue loading, ownership hiding with 404, and soft-delete hiding without nested-data leakage.
- `SuperadminSeederTest` RED failed on the missing seeder, then passed required environment validation, server-controlled role assignment, and password hashing.
- Independent review found no Critical issues. Its Important safe-error-envelope finding and Minor auth timing plus `/me` coverage findings were corrected and verified.
- Final API verification passed 23 tests with 97 assertions; Pint passed. Disposable SQLite `migrate:fresh --seed` passed with synthetic environment values.
- The PostgreSQL 16 parity suite is configured as a separate CI job; it was not run locally because no PostgreSQL server or Docker daemon was available.
- Mobile regression verification passed 90 tests in 23 files, strict typecheck, and production build.

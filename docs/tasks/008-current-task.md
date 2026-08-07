# Task 008 — OpenAPI contract and secure mobile authentication

**Status:** Complete

**Plan source:** Task 8 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Define the canonical versioned API contract, generate strict mobile transport types from it, and add secure Sanctum authentication that preserves offline access to locally persisted scripts and recording routes.

## Acceptance

- OpenAPI documents every planned MVP operation with stable error envelopes and explicit authentication/error responses.
- Contract tests map implemented Laravel routes to operation IDs and validate representative login, identity, and script responses.
- Generated TypeScript schema is committed and checked for drift; handwritten duplicate transport DTOs are not introduced.
- Login stores the token before requesting identity, clears it when identity loading fails, and never persists the password.
- Logout clears local credentials even when the server is unavailable; a missing or expired token still permits local-only script and recording access.
- `SecureTokenStore` is the only module importing secure storage, and `ApiClient` applies bearer auth, correlation IDs, timeout handling, normalized errors, and credential redaction.
- Focused/full API and mobile suites, typecheck, production build, Capacitor sync, and Android debug verification pass.

## Execution rule

Work through Task 8 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 9.

## Progress

- Confirmed Tasks 001–007 are complete from Git history, task checkpoints, and the development log.
- Created branch `codex/task-008-openapi-auth` from clean `main` at `773c83c`.

## Completion evidence

- `OpenApiContractTest` RED failed because `docs/api/openapi.yaml` was absent, then passed with all nine planned operation IDs, implemented-route mapping, and login/me/script response examples validated against their schemas.
- `AuthActions`, `ApiClient`, `SecureTokenStore`, and `LoginView` suites each failed first on missing behavior and then passed token ordering/cleanup, timeout/error normalization, the single secure-storage key, password non-persistence, localized auth states, first-launch login, explicit local-only access, and non-blocking local routes.
- Review found and corrected the first-launch navigation gap, an application-to-infrastructure port dependency, the duplicated OpenAPI server prefix, and a missing `generating` cue status. No Critical or Important issue remains in the reviewed snapshot.
- Final API verification passed 27 tests with 310 assertions; Pint passed.
- Final mobile verification passed 106 tests in 27 files; strict typecheck, production build, E2E gate, deterministic contract regeneration, and Capacitor sync passed.
- Final Android verification completed `testDebugUnitTest assembleDebug` successfully with 297 actionable tasks (29 executed, 268 up-to-date). The two existing Capacitor `flatDir` warnings remain unchanged.

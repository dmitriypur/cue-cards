# Cue Cards MVP — implementation roadmap

The approved product design is in [`docs/superpowers/specs/2026-08-05-cue-cards-youtube-mvp-design.md`](superpowers/specs/2026-08-05-cue-cards-youtube-mvp-design.md). The executable TDD plan with exact files, interfaces, commands, and commits is in [`docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`](superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md).

## Phases

| Phase | Deliverable | Acceptance gate | Status |
|---|---|---|---|
| 1 | Monorepo, Laravel/Vue/Capacitor skeletons, CI | API and mobile baseline tests/build pass | Complete |
| 2 | Mobile domain, SQLite, library | Scripts survive restart and render from local data | Complete |
| 3 | MD/TXT import and preview | Synthetic Cyrillic fixtures parse and can be corrected before save | Complete |
| 4 | Card editor | Edit, reorder, split, merge, soft-delete, undo, stale-cue rules pass | Complete |
| 5 | Offline recording mode | Position/mode persist; swipe/buttons work; screen sleep is restored on exit | Complete |
| 6 | Laravel identity and script API | Superadmin login and ownership-protected API pass on SQLite and PostgreSQL | Complete |
| 7 | Outbox sync and conflicts | Commands are idempotent; 409 keeps both versions; retry resumes after offline | Complete |
| 8 | AI cues and usage | Fake structured generation, retries, stale-hash protection, and usage accounting pass | Complete |
| 9 | E2E, accessibility, privacy, and failure hardening | Full API/mobile/PostgreSQL/E2E/Android debug matrix passes | Complete |
| 10 | Production API deployment | HTTPS API, PostgreSQL, database queue worker, and GitHub `main` auto-deploy pass demo smoke tests | Complete — Task 14 |
| 11 | Signed Android APK | Signed personal-demo release APK targets the production API and passes build, signature, and login checks | Complete — Task 15 |

## Scope guard

The MVP does not include Filament, Inertia, billing, subscriptions, Google Play publication, public registration, iOS, Redis/Horizon, or non-YouTube workflows. The code retains extension seams for those capabilities without implementing them prematurely.

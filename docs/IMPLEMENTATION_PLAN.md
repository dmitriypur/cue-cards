# Cue Cards MVP — implementation roadmap

The approved product design is in [`docs/superpowers/specs/2026-08-05-cue-cards-youtube-mvp-design.md`](superpowers/specs/2026-08-05-cue-cards-youtube-mvp-design.md). The executable TDD plan with exact files, interfaces, commands, and commits is in [`docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`](superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md).

## Phases

| Phase | Deliverable | Acceptance gate | Status |
|---|---|---|---|
| 1 | Monorepo, Laravel/Vue/Capacitor skeletons, CI | API and mobile baseline tests/build pass | Planned |
| 2 | Mobile domain, SQLite, library | Scripts survive restart and render from local data | Planned |
| 3 | MD/TXT import and preview | Synthetic Cyrillic fixtures parse and can be corrected before save | Planned |
| 4 | Card editor | Edit, reorder, split, merge, soft-delete, undo, stale-cue rules pass | Planned |
| 5 | Offline recording mode | Position/mode persist; swipe/buttons work; screen sleep is restored on exit | Planned |
| 6 | Laravel identity and script API | Superadmin login and ownership-protected API pass on SQLite and PostgreSQL | Planned |
| 7 | Outbox sync and conflicts | Commands are idempotent; 409 keeps both versions; retry resumes after offline | Planned |
| 8 | AI cues and usage | Fake structured generation, retries, stale-hash protection, and usage accounting pass | Planned |
| 9 | Hardening and signed APK | Full CI/E2E passes; signed release APK installs and works after force-stop offline | Planned |

## Scope guard

The MVP does not include Filament, Inertia, billing, subscriptions, Google Play publication, public registration, iOS, Redis/Horizon, or non-YouTube workflows. The code retains extension seams for those capabilities without implementing them prematurely.

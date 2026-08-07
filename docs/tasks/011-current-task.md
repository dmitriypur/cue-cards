# Task 011 — structured AI cues, usage accounting, and source preservation

**Status:** Complete

**Plan source:** Task 11 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Generate validated 3–5 cue arrays through a server-only Laravel AI adapter, apply them only to unchanged non-manual cue sets, publish accepted results through the ordinary sync feed, and record provider usage without exposing secrets or replacing full script text.

## Acceptance

- AI generation requests and results validate expected card IDs, source hashes, cue counts, trimming, uniqueness, and maximum cue length.
- Script/card endpoints are ownership-safe, technically rate-limited, and enqueue database-backed AI work without returning provider secrets.
- Queue execution batches deterministically, retries at most three times, sanitizes provider failures, and accounts usage for superadmin calls.
- Accepted cues apply only when the current content hash matches the captured source hash and cues were not manually edited; full text is never written from AI output.
- Accepted aggregate changes increment the script version once and append one ordinary `sync_changes` snapshot transactionally.
- OpenAPI/generated mobile types, focused/full API suites, Pint, PostgreSQL parity, and contract drift checks pass.

## Execution rule

Work through Task 11 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 12.

## Progress

- Confirmed Tasks 001–010 are complete from Git history, task checkpoints, and the development log.
- Created branch `codex/task-011-ai-cues` from clean `main` at `70a78cf`.
- Baseline API verification passed 64 tests (63 passed, 1 PostgreSQL-only skipped) with 486 assertions; Pint passed.
- Implemented validated structured requests/results, DeepSeek adapter, database-backed generation lifecycle, ownership/entitlement/rate safeguards, deterministic batching, three-attempt job handling, safe failures, per-call usage, hash/manual-edit protection, and transactional sync publication.
- Final SQLite API: 88 tests (87 passed, 1 PostgreSQL-only skipped), 615 assertions. PostgreSQL: 88 passed, 622 assertions. Pint passed.
- Mobile regression: 150 tests, strict typecheck, production build, E2E gate, and deterministic contract generation at `3da42f7bc0e3800e9e997bfd27e5dcba17970e74` passed.
- Task 011 is complete. Task 012 has not started.

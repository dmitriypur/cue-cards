# Task 021 — Preserve in-flight AI generation ownership during sync

## Goal

Prevent a client snapshot synchronized while AI generation is running from clearing the server-owned generation identifier and causing valid generated cues to be discarded.

## Scope

- Add a regression test that reproduces a client snapshot clearing an in-flight generation identifier.
- Preserve the existing server generation identifier when an incoming cue snapshot has no generation identifier.
- Verify focused and complete API suites and formatting.
- Deploy the server-only fix and regenerate cues for the affected production script using synthetic-safe diagnostics that do not expose script text.

## Progress

- [x] Confirmed production generation completed 16/16 cards while all cue sets remained pending.
- [x] Confirmed all source hashes match and all 16 server generation identifiers were cleared by a later sync snapshot.
- [x] Add the failing regression test.
- [x] Keep generation ownership server-controlled when applying client sync snapshots.
- [x] Run focused and full verification.
- [ ] Record evidence, commit, merge to `main`, push, and verify production.
- [ ] Regenerate and confirm ready cues for the affected production script.

## Verification evidence

- RED: the sync-path regression failed because the client snapshot cleared the current server `generation_id`.
- GREEN: sync cannot clear the current link or replace it with an older generation link; both focused regressions passed.
- AI/sync regression suites passed 26 tests with 160 assertions.
- Full API suite passed 101 tests with 1 skipped and 697 assertions; `./vendor/bin/pint --test` passed.

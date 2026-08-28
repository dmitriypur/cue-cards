# Task 020 — preserve synchronized script text

**Status:** Complete

## Outcome

Allow Markdown snapshots containing significant leading or trailing whitespace to synchronize without Laravel changing `source_text` or `full_text` before content-hash validation.

## Progress

- [x] Confirmed production sync requests fail with HTTP 422 because `TrimStrings` changes `full_text` before hash validation.
- [x] Add a failing API regression test for byte-preserving synchronization.
- [x] Exclude synchronized source/card text from request trimming.
- [x] Run focused and full API verification.
- [x] Record evidence, commit, merge to `main`, push, and verify production deployment.

## Evidence

- RED: the new HTTP regression test received 422 with `Card content hash does not match its full text`.
- GREEN: the same test passed 1/1 with 3 assertions and persisted `source_text`/`full_text` byte-for-byte.
- Focused sync/privacy verification passed 17/17 tests with 139 assertions.
- Full API verification passed 99 tests with 695 assertions; one environment-specific test was skipped.
- Laravel Pint passed.
- Task commit `7df00f1` was merged into `main` as `d746aeea2826671cd5b049686ae2d453bf625fe4` and pushed.
- GitHub Actions run `33149255069` passed API, PostgreSQL 16, Mobile, Mobile E2E, Android debug, and Deploy API.
- Production checkout matched the merge SHA; HTTPS `/up` returned 200 and Nginx, PHP-FPM, PostgreSQL, Supervisor, and the AI worker were active.
- A temporary-superadmin HTTPS smoke returned login 200 and sync 200 for synthetic Cyrillic Markdown with significant outer whitespace. PostgreSQL retained `source_text`, `full_text`, and `content_hash` exactly; all temporary smoke data was removed.

# Task 003 — Markdown/TXT import and correctable preview

**Status:** Complete

**Plan source:** Task 3 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Parse synthetic UTF-8 Markdown and TXT source documents locally, let the user correct the resulting draft, and save the approved script through the existing SQLite-first aggregate action.

## Acceptance

- Markdown import uses `#` as the script title, starts cards at `##`, preserves deeper headings in card text, and reports empty cards.
- TXT import uses only the documented deterministic heading heuristic and reports ambiguous structure without AI.
- Source validation accepts only `.md` and `.txt`, rejects empty or oversized input, and computes an import SHA-256 hash.
- Preview edits stay in memory until Save; validation errors disable Save.
- Saving creates UUIDv7 identifiers and calls `SaveScriptAggregate`; cancelling does not write local storage.
- Focused tests, the full mobile suite, strict typecheck, production build, Capacitor sync, and Android debug build pass.

## Execution rule

Work through Task 3 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 4.

## Completion evidence

- Markdown, TXT, source-validation, draft-editing, file-picker, workflow, save, and preview tests each failed first on their missing behavior and then passed.
- Approved drafts are converted to UUIDv7 script/card/cue identifiers and persisted only through transactional `SaveScriptAggregate`.
- The final mobile suite, strict typecheck, production build, Capacitor sync, Android unit tests, and debug APK assembly pass.

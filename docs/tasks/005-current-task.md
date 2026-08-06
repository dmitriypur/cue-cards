# Task 005 — card editor and stale-cue rules

**Status:** Complete

**Plan source:** Task 5 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Outcome

Let the user edit, reorder, split, and merge locally persisted cards and manually edit cue lists while preserving the full source text and hash-based stale-cue rules.

## Acceptance

- Editing title or full text, reordering, splitting, merging, and cue edits use immutable aggregate copies and one `SaveScriptAggregate` call per successful action.
- Full-text changes recalculate `contentHash`, retain previous cue strings, and mark mismatched generated cues `stale`.
- Manual cue edits require 3–5 trimmed non-empty strings, set `manuallyEdited=true`, and never alter full text.
- The editor persists debounced text changes locally, flushes on route leave/app background, and exposes local saved/pending state independently of networking.
- Editor controls are accessible, use semantic theme tokens, and provide at least 48×48 CSS-pixel touch targets.
- Focused tests, the complete mobile suite, strict typecheck, production build, Capacitor sync, and Android debug verification pass.

## Execution rule

Work through Task 5 only using RED/GREEN TDD, record exact verification evidence in `docs/DEVELOPMENT_LOG.md`, and do not begin Task 6.

## Progress

- Confirmed Tasks 001–004 are complete from Git history, task checkpoints, and the development log.
- Created branch `codex/task-005-editor` from clean `main` at `0a3552a`.

## Completion evidence

- `CardEditing` RED failed on the missing application actions, then passed with immutable update, reorder, Unicode-safe split, merge, stale-cue, and manual-cue behavior.
- `ScriptEditorView` RED failed on the missing editor modules, then passed with local load/save states, debounced persistence, reorder, split/merge controls, cue editing, semantic surfaces, and 48 px controls.
- Review reproduced a concurrent background-flush race (`expected 1 update, got 2`); sequential snapshot persistence now passes the regression test.
- Native background-listener cleanup and the draggable handle are covered by focused tests.
- The complete API/mobile, typecheck, build, Capacitor, and Android debug verification matrix passes.

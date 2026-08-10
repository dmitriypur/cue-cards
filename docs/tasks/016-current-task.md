# Task 016 — AI sync ordering and stable Android layout

**Status:** Design approved; implementation plan pending

## Outcome

Prevent AI-start version gaps from producing false conflicts, keep real conflicts explicit, stop the global sync banner from vertically shifting the Android screen, and ship an updated signed APK.

## Evidence and scope

- Production has one completed generation with 10/10 ready cue sets for the affected script.
- Root cause and approved design are recorded in `docs/superpowers/specs/2026-08-10-ai-sync-and-layout-stability-design.md`.
- Existing persisted conflict remains a one-time explicit server-version choice.
- No unrelated card-density redesign or server hardening is included.

## Progress

- [x] Reproduced the faulty version ordering from source and production-safe metadata.
- [x] Identified variable sync-banner height as the vertical layout shift.
- [x] Received owner approval for the proposed design.
- [ ] Write and review the implementation plan.
- [ ] Implement through focused RED/GREEN tests.
- [ ] Build, sign, verify, merge, push, and provide the updated APK.

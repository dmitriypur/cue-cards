# Adaptive Cues and Offline Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate semantically sufficient variable-length speaking cues and prove that synchronized results remain available offline on Android.

**Architecture:** The existing Laravel queue and sync feed remain authoritative. The AI request gains script outline context, cue validators remove the fixed 3–5 range, and the mobile repository exposes an offline-ready card count derived from SQLite.

**Tech Stack:** Laravel 13, Laravel AI SDK/DeepSeek, PostgreSQL/SQLite, Vue 3, strict TypeScript, Capacitor 8, Vitest, PHPUnit, Playwright, and Android Gradle.

**Spec:** `docs/superpowers/specs/2026-08-22-adaptive-cues-offline-sync-design.md`

## Global Constraints

- Every mobile mutation is SQLite-first; network failure never rolls back local work.
- AI never writes `full_text` and applies cues only to a matching source hash.
- Ready cue sets contain one or more unique non-empty strings of at most 200 characters, with no fixed count maximum.
- Script text, credentials, tokens, AI keys, and signing material are never logged or committed.
- Tests use synthetic Cyrillic content and every behavior change follows RED/GREEN TDD.

---

### Task 1: Adapt the server AI and sync contracts

- [x] Write failing domain, adapter, queue, and snapshot tests for one and six-plus cues plus script outline context.
- [x] Run focused tests and confirm failures identify the existing 3–5 validation and missing context.
- [x] Add outline-aware requests, prompt version 2, adaptive instructions, validation, and byte-aware batching.
- [x] Remove the OpenAPI `maxItems` constraint and regenerate the committed TypeScript contract.
- [x] Run focused API/contract suites and commit the server increment.

### Task 2: Adapt manual cue editing and offline readiness UI

- [x] Write failing action/component/repository tests for one and six-plus manual cues and `offlineReadyCardCount`.
- [x] Run focused mobile tests and confirm failures identify the current 3–5/UI limits and missing summary field.
- [x] Update domain types, SQLite/browser summaries, editor validation and controls, and library sync refresh.
- [x] Run focused mobile suites and commit the mobile increment.

### Task 3: Prove synchronized cues survive offline restart

- [x] Write a failing SQLite integration test for remote six-plus cues, cursor persistence, repository reconstruction, and offline read.
- [x] Extend the Playwright journey to display more than five cues after offline reload.
- [x] Implement only missing wiring revealed by the tests and rerun focused suites.
- [x] Commit the offline regression increment.

### Task 4: Verify, deploy, and package

- [x] Run full API, Pint, OpenAPI drift, mobile unit, typecheck, build, E2E, Capacitor, and Android checks.
- [x] Update Android to version code 2/name 1.1 and build the production-connected signed APK.
- [ ] Merge to `main`, push, wait for exact-SHA CI/deploy, and run production health plus synthetic DeepSeek smoke.
- [ ] Install/update and run the offline device smoke when ADB is available; otherwise record APK path, signature, and checksum.
- [ ] Complete Task 018 and record exact evidence in `docs/DEVELOPMENT_LOG.md`.

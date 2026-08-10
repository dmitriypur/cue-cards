# Task 014 — personal demo API deployment

**Status:** Complete; merged into `main` as `63ef599` and deployed

## Required outcome

Deploy `apps/api` to the existing Ubuntu server so the owner's Android APK can use login, synchronization, and AI cues through `https://cue-cards.web-func.ru`.

This is a personal demo deployment. Backup automation, restore drills, protected-environment approvals, dedicated deploy users, and production-scale hardening are deferred until the demo has been evaluated.

## Demo deployment

- Server path: `/var/www/cue-cards-api`.
- Laravel root: `/var/www/cue-cards-api/apps/api`.
- Deploy trigger: every push to GitHub `main`, without waiting for CI jobs.
- Deploy transport: root SSH, matching the existing `entrepreneur-platform` pattern.
- Runtime: PHP 8.3, PostgreSQL 16, Nginx, Supervisor, database queue `ai`.
- Health: `https://cue-cards.web-func.ru/up`.

## Progress

- [x] Created branch/worktree `codex/task-014-production-api-deploy` from `main` at `c7e7829`.
- [x] Added a minimal GitHub SSH deployment job.
- [x] Added the short server setup guide in `docs/API_DEPLOYMENT.md`.
- [x] Verified the workflow YAML and embedded deployment Bash syntax without repeating application test suites.
- [x] Connected `origin` to `git@github.com:dmitriypur/cue-cards.git`; SSH access succeeds and the remote repository is currently empty.
- [x] Configured GitHub `HOST`, `PORT`, `USERNAME`, `SSH_KEY`, `APP_DIR`, and `API_BASE_URL` with a dedicated Cue Cards deploy key; secret values were not printed or committed.
- [x] Added DNS for `cue-cards.web-func.ru`; it resolves to `77.222.42.47`.
- [x] Provisioned the server checkout, production `.env` without an AI key, PostgreSQL role/database, all migrations, HTTP Nginx site, and running Supervisor worker.
- [x] Issued the trusted Certbot certificate (expires 2026-11-07); HTTP redirects with 301 and HTTPS `/up` returns 200.
- [x] Reused the existing server-side DeepSeek credential after explicit approval, rebuilt config cache, and restarted the running AI worker without exposing the key.
- [x] Create the initial superadmin securely; production verification returned exactly one user, one `superadmin`, and one distinct email without exposing account data.
- [x] Verified the deployed commit, production environment, disabled debug mode, PostgreSQL migrations, database queue, running `ai` worker, and trusted HTTPS `/up` response.
- [x] Reproduced and fixed the plain-client API authentication failure: unauthenticated `/api/v1/me` now has a focused regression test requiring the stable 401 JSON envelope instead of a missing web-login redirect.
- [x] Diagnosed the first public GitHub run without repeating tests: API and PostgreSQL jobs passed; mobile jobs stopped at `npm ci` because the lock omitted the required `eslint` peer. Added the exact dev dependency and verified a clean install.
- [x] Pushed the deploy workflow to `main`; GitHub Actions run `31369946328` completed API, PostgreSQL, mobile, E2E, Android debug, and Deploy API jobs successfully.
- [x] Verified production login, sync, sync idempotency, one supervised DeepSeek generation, 3–5 cues, matching source hash, preserved full text, sanitized logs, and smoke-data cleanup.
- [x] Committed Task 14 as `4f61b99`, merged into `main` as `63ef599`, pushed, and confirmed the server checkout at the exact merge commit.

## Scope guard

- Task 15 may now start against the verified demo API.
- Do not print or commit `.env`, passwords, tokens, API keys, SSH keys, or signing material.
- Do not add Redis, Horizon, billing, public registration, backup automation, or restore drills to this demo task.

# Task 014 — production API deployment

**Status:** Ready; implementation not started

**Plan source:** Task 14 in `docs/superpowers/plans/2026-08-05-cue-cards-mvp-implementation-plan.md`.

## Required outcome

Deploy `apps/api` to the existing Ubuntu server with PostgreSQL, trusted HTTPS, a supervised database-queue worker for queue `ai`, backup/restore evidence, sanitized logs, rollback instructions, and GitHub auto-deploy from a successful `main` CI run. Task 15 may build the signed APK only after the production API passes its smoke tests.

## Confirmed starting point

- Tasks 001–013 are complete and merged into `main`; Task 13 merge commit is `04a760a`.
- The Cue Cards worktree was clean after merged verification. The repository currently has no Git remote configured.
- Reference workflow: `/Users/dmitriypur/Desktop/LARAVEL_PROJECTS/entrepreneur-platform/.github/workflows/deploy.yml`.
- Reference server application: `/var/www/predprinimatel`, deployed from GitHub `main` through SSH.
- Server audit on 2026-08-08 was read-only except for the separately authorized removal of obsolete `services-worker` from active Supervisor configuration.

## Audited server baseline

- Ubuntu 24.04; PHP 8.3.30; Composer 2.8.6; Nginx 1.24; PostgreSQL 16.14; Supervisor, Redis, PHP-FPM, and Certbot are active.
- Required PHP modules, including `pdo_pgsql`, `curl`, `mbstring`, `intl`, `xml`, and `zip`, are installed.
- PostgreSQL listens on localhost, has a 100-connection limit and used 6 connections during the audit.
- Root filesystem had approximately 4.6 GiB free; about 1.9 GiB memory was available.
- PHP-FPM runs as `www-data` through `/run/php/php8.3-fpm.sock`.
- Existing TLS/health flow works: `https://test.web-func.ru/up` returned 200 with a valid certificate.
- The server can read the existing GitHub repository over SSH. The new Cue Cards repository still requires its own remote and GitHub Actions variables/secrets.
- Obsolete `/etc/supervisor/conf.d/services-worker.conf` referenced the deleted `/var/www/services_master`; it was recoverably moved to `services-worker.conf.disabled`. The remaining application workers stayed running.

## Risks that must be handled before deployment

- No application PostgreSQL backup files, backup timer/cron, or off-server restore evidence were found. The first production migration is blocked until backup retention and a separate restore drill exist.
- SSH currently permits root login and password authentication. Existing GitHub deployment uses root, but Task 14 should prefer a dedicated non-root deploy owner or explicitly record acceptance of the temporary root-key risk.
- Nginx has an unrelated duplicate HTTP declaration for `www.cartocrimea.ru`; `nginx -t` succeeds, so it does not block Cue Cards.
- Supervisor has no Cue Cards worker yet. The required command is `/usr/bin/php8.3 /var/www/cue-cards-api/apps/api/artisan queue:work database --queue=ai --sleep=1 --tries=3 --timeout=100` as `www-data`.
- Laravel/worker log rotation must be bounded to avoid consuming the remaining disk space.

## Operator confirmations required before any production mutation

1. Confirm or replace the recommended API domain `cue-cards.web-func.ru`.
2. Provide/create the GitHub repository and authorize adding `origin`; configure repository Actions variables/secrets without exposing values.
3. Approve reuse of the existing server-side DeepSeek credential or provide a replacement securely. Never copy its value into Git, task files, logs, or chat output.
4. Select an off-server PostgreSQL backup destination and retention policy.
5. Provide the initial superadmin name/email/password through a secure channel. The password is one-time bootstrap input and must be removed from persistent environment configuration after seeding.
6. Choose a dedicated deploy user or explicitly approve continued root-key deployment for the MVP.

## Execution order

1. Report that Task 14 is starting; recheck Git history, status, this checkpoint, and the server baseline without repeating completed Task 13 work.
2. Create isolated branch/worktree `codex/task-014-production-api-deploy`.
3. Implement and test the runtime-permissions verifier, GitHub deploy job, and deployment documentation.
4. Run the complete local CI-equivalent matrix and independent review before touching production.
5. Establish backup/restore and rollback evidence.
6. Provision database, application path, secret environment, Nginx/TLS, Supervisor, permissions, and log rotation using exact resolved targets and recoverable config changes.
7. Deploy through GitHub `main`, then verify health, authentication, sync, one synthetic AI job, sanitized logs, and rollback.
8. Record safe evidence, commit/merge Task 14, clean its branch/worktree, and report that Task 15 is next but not started.

## Scope guard

- Do not start Android signing or Task 15.
- Do not install Redis/Horizon into Cue Cards; its MVP queue remains PostgreSQL-backed.
- Do not run `migrate:rollback` in production.
- Do not print or commit `.env`, database passwords, access tokens, AI keys, SSH keys, superadmin passwords, user script text, database dumps, or signing material.
- Use only synthetic Cyrillic content for production smoke tests.

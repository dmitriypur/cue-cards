# Cue Cards API demo deployment

This is the minimal personal/demo deployment for `apps/api`.

## GitHub settings

Repository variable:

- `API_BASE_URL=https://cue-cards.web-func.ru`

Repository secrets:

- `HOST`
- `PORT`
- `USERNAME` (`root` for the current demo deployment)
- `SSH_KEY`
- `APP_DIR=/var/www/cue-cards-api`

Every push to `main` starts the deploy job directly. It does not wait for the test jobs.

## First server setup

Clone the GitHub repository:

```bash
git clone git@github.com:OWNER/cue-cards.git /var/www/cue-cards-api
cd /var/www/cue-cards-api
git switch main
```

Create PostgreSQL credentials interactively and the database:

```bash
sudo -u postgres createuser --login --pwprompt cue_cards
sudo -u postgres createdb --owner=cue_cards --encoding=UTF8 cue_cards
```

Create `/var/www/cue-cards-api/apps/api/.env` without committing or printing its secret values:

```dotenv
APP_NAME="Cue Cards API"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://cue-cards.web-func.ru

LOG_CHANNEL=stack
LOG_LEVEL=warning

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=cue_cards
DB_USERNAME=cue_cards
DB_PASSWORD=

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database

DEEPSEEK_API_KEY=
DEEPSEEK_URL=https://api.deepseek.com
CUE_CARDS_AI_MODEL=deepseek-chat
```

Install Composer dependencies and generate the Laravel key directly into `.env`:

```bash
cd /var/www/cue-cards-api/apps/api
composer install --no-dev --prefer-dist --no-interaction --no-progress
/usr/bin/php8.3 artisan key:generate --force --no-interaction
```

## Nginx and HTTPS

The Nginx site uses:

- domain `cue-cards.web-func.ru`;
- root `/var/www/cue-cards-api/apps/api/public`;
- PHP socket `/run/php/php8.3-fpm.sock`.

Only `/up`, `/api/v1/*`, and the internal `/index.php` front controller need to reach Laravel. After creating the server block:

```bash
nginx -t
systemctl reload nginx
certbot --nginx -d cue-cards.web-func.ru
curl --fail --silent --show-error https://cue-cards.web-func.ru/up >/dev/null
```

## AI queue worker

Create `/etc/supervisor/conf.d/cue-cards-ai-worker.conf`:

```ini
[program:cue-cards-ai-worker]
directory=/var/www/cue-cards-api/apps/api
command=/usr/bin/php8.3 /var/www/cue-cards-api/apps/api/artisan queue:work database --queue=ai --sleep=1 --tries=3 --timeout=100
user=www-data
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stopwaitsecs=110
redirect_stderr=true
stdout_logfile=/var/log/supervisor/cue-cards-ai-worker.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
```

Enable it:

```bash
supervisorctl reread
supervisorctl update
supervisorctl status cue-cards-ai-worker
```

## Initial superadmin

Run once from a private SSH session. The password is held only in the current process:

```bash
set +x
cd /var/www/cue-cards-api/apps/api
read -r -p 'Name: ' SUPERADMIN_NAME
read -r -p 'Email: ' SUPERADMIN_EMAIL
read -r -s -p 'Password: ' SUPERADMIN_PASSWORD
printf '\n'
export SUPERADMIN_NAME SUPERADMIN_EMAIL SUPERADMIN_PASSWORD
/usr/bin/php8.3 artisan db:seed --class='Database\Seeders\SuperadminSeeder' --force
unset SUPERADMIN_NAME SUPERADMIN_EMAIL SUPERADMIN_PASSWORD
```

## Normal deploy

Push or merge a commit into `main`. GitHub Actions then:

1. connects over SSH;
2. resets the server checkout to `origin/main`;
3. runs production Composer install and migrations;
4. rebuilds Laravel caches;
5. fixes runtime permissions;
6. restarts PHP-FPM and the AI worker;
7. checks `https://cue-cards.web-func.ru/up`.

Backup automation, restore drills, environment approvals, and production-scale operations are intentionally deferred until after the personal demo is evaluated.

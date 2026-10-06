#!/usr/bin/env bash
set -euo pipefail

python -c "from pathlib import Path; from config import settings; settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True); database = settings.DATABASES['default']; Path(database['NAME']).parent.mkdir(parents=True, exist_ok=True) if database['ENGINE'] == 'django.db.backends.sqlite3' else None"
if [ "${DJANGO_ALLOW_EPHEMERAL_SQLITE:-false}" = "true" ] && [ -z "${DATABASE_URL:-}" ]; then
	printf '%s\n' 'WARNING: Free Render SQLite and uploads are temporary. Sleep, restart, or redeploy can erase all accounts, stories, and media.' >&2
fi
bash predeploy.sh
exec python -m gunicorn config.wsgi:application --config gunicorn.conf.py
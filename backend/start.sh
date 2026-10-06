#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${DJANGO_MEDIA_ROOT:?Set DJANGO_MEDIA_ROOT to persistent storage}"
exec python -m gunicorn config.wsgi:application --config gunicorn.conf.py
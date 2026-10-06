#!/usr/bin/env bash
set -euo pipefail

python manage.py migrate --noinput
python manage.py createcachetable
python manage.py check --deploy --fail-level WARNING
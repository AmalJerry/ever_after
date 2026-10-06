#!/usr/bin/env bash
set -euo pipefail

python manage.py migrate --noinput
python manage.py createcachetable --noinput
python manage.py check --deploy --fail-level WARNING
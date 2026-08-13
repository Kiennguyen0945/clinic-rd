#!/bin/sh
set -e

/opt/venv/bin/python manage.py migrate --no-input
exec /opt/venv/bin/gunicorn config.wsgi:application \
    --bind 0.0.0.0:8001 \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -

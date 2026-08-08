#!/bin/sh
# Production entrypoint for Django backend

echo "Running database migrations..."
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.production}"
/opt/venv/bin/python manage.py migrate --no-input

echo "Creating superuser (if not exists)..."
/opt/venv/bin/python manage.py createsuperuser --no-input || true

echo "Starting cron scheduler..."
/usr/sbin/crond

echo "Starting Gunicorn server..."
exec /opt/venv/bin/gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -

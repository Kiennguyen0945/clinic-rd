#!/bin/sh
# Production entrypoint for Django backend

echo "Running database migrations..."
python manage.py migrate --no-input

echo "Creating superuser (if not exists)..."
python manage.py createsuperuser --no-input || true

echo "Starting Gunicorn server..."
exec gunicorn backend.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -

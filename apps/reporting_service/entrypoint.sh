#!/bin/sh
set -e

/opt/venv/bin/python manage.py migrate --no-input
exec /opt/venv/bin/python manage.py runserver 0.0.0.0:8001

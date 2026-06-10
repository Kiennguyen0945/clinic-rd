#!/bin/sh
/opt/venv/bin/python manage.py migrate
/opt/venv/bin/python manage.py createsuperuser --no-input || true
exec /opt/venv/bin/python manage.py runserver 0.0.0.0:8000
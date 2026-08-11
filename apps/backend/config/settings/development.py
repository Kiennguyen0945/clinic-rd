"""Settings for local development."""

from decouple import config

from .base import *

SECRET_KEY = config(
    "DJANGO_SECRET_KEY",
    default="django-insecure-local-development-only",
)
DEBUG = True
ALLOWED_HOSTS = ["*"]

DB_ENGINE = config("DJANGO_DB_ENGINE", default="postgres")

if DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("POSTGRES_DB", default="clinic_db"),
            "USER": config("POSTGRES_USER", default="postgres"),
            "PASSWORD": config("POSTGRES_PASSWORD", default="123456"),
            "HOST": config("POSTGRES_HOST", default="db"),
            "PORT": config("POSTGRES_PORT", default="5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

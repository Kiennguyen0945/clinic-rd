"""Settings for automated tests, locally and in CI."""

from .development import *

DEBUG = False

# CI sets DJANGO_DB_ENGINE=postgres to exercise the production database. Local
# tests remain self-contained when no PostgreSQL environment is configured.
if DB_ENGINE != "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

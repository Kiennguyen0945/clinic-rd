"""Fast, deterministic settings for automated tests."""

import os

os.environ.setdefault("DJANGO_DB_ENGINE", "sqlite")

from .base import *  # noqa: E402,F403

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

if DB_ENGINE != "postgres":  # noqa: F405
    DATABASES["default"]["NAME"] = ":memory:"  # noqa: F405

"""Fast, deterministic settings for automated tests."""

import os

os.environ.setdefault("DJANGO_DB_ENGINE", "sqlite")

from .base import *

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

if DB_ENGINE != "postgres":
    DATABASES["default"]["NAME"] = ":memory:"

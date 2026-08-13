"""Settings for the independently deployable Reporting Service."""

from pathlib import Path

from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config(
    "REPORTING_DJANGO_SECRET_KEY",
    default="django-insecure-reporting-development-only",
)
DEBUG = config("REPORTING_DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("REPORTING_ALLOWED_HOSTS", default="*").split(",")
CLINIC_CORE_URL = config("CLINIC_CORE_URL", default="http://clinic-core:8000").rstrip("/")
INTERNAL_SERVICE_TOKEN = config("INTERNAL_SERVICE_TOKEN", default="")
CORE_JWT_SIGNING_KEY = config("CORE_JWT_SIGNING_KEY", default="")
CORE_JWT_ALGORITHM = "HS256"
CORE_HTTP_TIMEOUT_SECONDS = config("CORE_HTTP_TIMEOUT_SECONDS", default=10, cast=int)

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

REPORTING_DB_ENGINE = config("REPORTING_DB_ENGINE", default="postgres")

if REPORTING_DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("REPORTING_DB_NAME", default="reporting_db"),
            "USER": config("REPORTING_DB_USER", default="reporting_user"),
            "PASSWORD": config("REPORTING_DB_PASSWORD", default=""),
            "HOST": config("REPORTING_DB_HOST", default="reporting-db"),
            "PORT": config("REPORTING_DB_PORT", default="5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": config("REPORTING_SQLITE_NAME", default=":memory:"),
        }
    }

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Ho_Chi_Minh"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

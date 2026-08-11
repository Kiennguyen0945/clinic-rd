"""Settings for deployed backend instances."""

from decouple import Csv, config

from .base import *

SECRET_KEY = config(
    "DJANGO_SECRET_KEY",
    default="django-insecure-o^b-9m4ux-ugm67z=w+14^39kk)g$^jp6q3fc$2ijg-&pq&v4u",
)
DEBUG = False
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="*", cast=Csv())

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

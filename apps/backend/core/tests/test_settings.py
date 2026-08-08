"""Tests for environment-specific settings."""

from django.conf import settings
from django.test import SimpleTestCase

from config.settings import development, production


class TestSettingsTests(SimpleTestCase):
    def test_test_settings_are_safe_and_deterministic(self):
        self.assertFalse(settings.DEBUG)
        self.assertEqual(settings.ROOT_URLCONF, "config.urls")
        self.assertEqual(settings.WSGI_APPLICATION, "config.wsgi.application")
        self.assertEqual(settings.ASGI_APPLICATION, "config.asgi.application")
        self.assertIn("core", settings.INSTALLED_APPS)
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"],
            ("core.api.authentication.CustomJWTAuthentication",),
        )

    def test_development_settings_enable_debug_and_local_cors(self):
        self.assertTrue(development.DEBUG)
        self.assertEqual(development.ALLOWED_HOSTS, ["*"])
        self.assertTrue(development.CORS_ALLOW_ALL_ORIGINS)

    def test_production_settings_disable_debug_and_open_cors(self):
        self.assertFalse(production.DEBUG)
        self.assertFalse(production.CORS_ALLOW_ALL_ORIGINS)
        self.assertNotIn("*", production.ALLOWED_HOSTS)

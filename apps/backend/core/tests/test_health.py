"""Smoke tests for the Clinic Core health endpoint."""

from django.test import SimpleTestCase
from django.urls import reverse


class HealthCheckTests(SimpleTestCase):
    def test_health_check_identifies_clinic_core(self):
        response = self.client.get(reverse("clinic-core-health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "healthy", "service": "clinic-core"},
        )

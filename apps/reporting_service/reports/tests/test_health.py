from django.test import SimpleTestCase
from django.urls import reverse


class ReportingHealthTests(SimpleTestCase):
    def test_health_endpoint_identifies_reporting_service(self):
        response = self.client.get(reverse("reporting-health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "healthy", "service": "reporting-service"},
        )

    def test_health_endpoint_is_get_only(self):
        response = self.client.post(reverse("reporting-health"))

        self.assertEqual(response.status_code, 405)

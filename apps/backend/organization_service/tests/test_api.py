from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from organization_service.models import Department


class OrganizationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_and_list_departments(self):
        response = self.client.post(
            reverse("department-list"),
            {"code": " noi ", "name": " Internal Medicine "},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Department.objects.get().code, "NOI")
        self.assertEqual(self.client.get(reverse("department-list")).status_code, 200)

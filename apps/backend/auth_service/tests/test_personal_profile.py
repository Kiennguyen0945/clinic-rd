from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .factories import create_user


class PersonalProfileApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = create_user(
            role_code="DOCTOR", username="doctor", email="doctor@example.com"
        )
        self.client.force_authenticate(self.user)

    def test_authenticated_user_reads_and_updates_personal_information(self):
        detail = self.client.get(reverse("personal-profile"))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["data"]["username"], "doctor")

        updated = self.client.patch(
            reverse("personal-profile"),
            {
                "fullName": "Trần Thị Mai",
                "email": "mai@example.com",
                "phone": "0901234567",
                "gender": "F",
                "dateOfBirth": "1990-06-30",
                "address": "Quận 1, TP.HCM",
                "username": "cannot-change",
                "status": "LOCKED",
            },
            format="json",
        )

        self.assertEqual(updated.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "BS. Trần Thị Mai")
        self.assertEqual(self.user.username, "doctor")
        self.assertEqual(self.user.status, "ACTIVE")

    def test_rejects_duplicate_email_and_future_birth_date(self):
        create_user(username="other", email="other@example.com")
        duplicate = self.client.patch(
            reverse("personal-profile"),
            {
                "fullName": "Doctor",
                "email": "OTHER@example.com",
                "phone": "0901234567",
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.data["error"]["code"], "DUPLICATE_EMAIL")

        future = self.client.patch(
            reverse("personal-profile"),
            {
                "fullName": "Doctor",
                "email": "doctor@example.com",
                "dateOfBirth": (timezone.localdate() + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(future.status_code, 400)

    def test_anonymous_user_cannot_access_profile(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(reverse("personal-profile")).status_code, 401)

"""Smoke tests for the root URL configuration."""

from django.test import SimpleTestCase
from django.urls import resolve


class RootUrlTests(SimpleTestCase):
    def test_admin_route_is_registered(self):
        match = resolve("/admin/")

        self.assertEqual(match.url_name, "index")

    def test_auth_route_is_registered(self):
        match = resolve("/api/auth/login/")

        self.assertEqual(match.url_name, "login-api")

    def test_patient_route_is_registered(self):
        match = resolve("/api/patients/")

        self.assertEqual(match.url_name, "patient-list")

    def test_appointment_route_is_registered(self):
        match = resolve("/api/appointments/")

        self.assertEqual(match.url_name, "appointment-list")

    def test_medical_record_route_is_registered(self):
        match = resolve("/api/medical-records/1/")

        self.assertEqual(match.url_name, "medical-record-update")

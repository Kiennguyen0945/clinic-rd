from datetime import datetime, time, timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from appointment_service.models import Appointment
from auth_service.models import Role, User
from organization_service.models import Department, Room
from patient_service.models import Patient


@override_settings(INTERNAL_SERVICE_TOKEN="test-service-token")
class ReportingSnapshotApiTests(TestCase):
    url = "/api/internal/reporting/snapshot/"

    @classmethod
    def setUpTestData(cls):
        doctor_role = Role.objects.create(code="DOCTOR", name="Doctor")
        receptionist_role = Role.objects.create(
            code="RECEPTIONIST",
            name="Receptionist",
        )
        manager_role = Role.objects.create(code="MANAGER", name="Manager")
        cls.doctor = User.objects.create(
            role=doctor_role,
            username="private-doctor",
            password_hash="hash",
            full_name="Private Doctor Name",
            phone="0900000100",
            status="ACTIVE",
        )
        cls.second_doctor = User.objects.create(
            role=doctor_role,
            username="second-doctor",
            password_hash="hash",
            full_name="Second Doctor",
            phone="0900000101",
            status="LOCKED",
        )
        cls.receptionist = User.objects.create(
            role=receptionist_role,
            username="private-receptionist",
            password_hash="hash",
            full_name="Private Receptionist",
            phone="0900000102",
            status="ACTIVE",
        )
        User.objects.create(
            role=manager_role,
            username="private-manager",
            password_hash="hash",
            full_name="Private Manager",
            phone="0900000103",
            status="INACTIVE",
        )
        cls.department = Department.objects.create(
            code="INTERNAL",
            name="Internal Department",
        )
        Room.objects.create(room_number="Internal Room")
        cls.patient = Patient.objects.create(
            patient_code="PRIVATE-PATIENT",
            full_name="Private Patient Name",
            dob="1990-01-01",
            gender="M",
            phone="0900999999",
            address="Private Address",
        )
        cls.start_date = timezone.localdate() - timedelta(days=2)
        cls.end_date = cls.start_date + timedelta(days=1)

        cls._create_appointment(cls.start_date, cls.doctor, "PENDING")
        cls._create_appointment(cls.start_date, cls.doctor, "COMPLETED")
        cls._create_appointment(cls.end_date, cls.second_doctor, "CANCELLED")
        cls._create_appointment(
            cls.end_date + timedelta(days=2),
            cls.doctor,
            "CONFIRMED",
        )

    @classmethod
    def _create_appointment(cls, appointment_date, doctor, status):
        appointment_time = timezone.make_aware(
            datetime.combine(appointment_date, time(9)),
            timezone.get_current_timezone(),
        )
        return Appointment.objects.create(
            patient=cls.patient,
            doctor=doctor,
            creator=cls.receptionist,
            department=cls.department,
            appointment_time=appointment_time,
            status=status,
            reason="Private appointment reason",
        )

    def _get_snapshot(self, **query_overrides):
        query = {
            "dateFrom": self.start_date.isoformat(),
            "dateTo": self.end_date.isoformat(),
            **query_overrides,
        }
        return self.client.get(
            self.url,
            query,
            HTTP_X_SERVICE_TOKEN="test-service-token",
        )

    def test_rejects_missing_or_invalid_service_token(self):
        query = {
            "dateFrom": self.start_date.isoformat(),
            "dateTo": self.end_date.isoformat(),
        }

        missing = self.client.get(self.url, query)
        invalid = self.client.get(
            self.url,
            query,
            HTTP_X_SERVICE_TOKEN="wrong-token",
        )

        self.assertEqual(missing.status_code, 401)
        self.assertEqual(invalid.status_code, 401)

    def test_validates_required_ordered_iso_date_range(self):
        missing = self.client.get(
            self.url,
            HTTP_X_SERVICE_TOKEN="test-service-token",
        )
        invalid = self._get_snapshot(dateFrom="13-08-2026")
        reversed_range = self._get_snapshot(
            dateFrom=self.end_date.isoformat(),
            dateTo=self.start_date.isoformat(),
        )
        oversized = self._get_snapshot(
            dateFrom="2025-01-01",
            dateTo="2026-01-02",
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(reversed_range.status_code, 400)
        self.assertEqual(oversized.status_code, 400)

    def test_returns_aggregated_snapshot_for_inclusive_range(self):
        response = self._get_snapshot()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload["period"],
            {
                "dateFrom": self.start_date.isoformat(),
                "dateTo": self.end_date.isoformat(),
            },
        )
        self.assertEqual(
            payload["appointmentsByDate"],
            [
                {
                    "date": self.start_date.isoformat(),
                    "total": 2,
                    "pending": 1,
                    "confirmed": 0,
                    "waiting": 0,
                    "inProgress": 0,
                    "completed": 1,
                    "cancelled": 0,
                },
                {
                    "date": self.end_date.isoformat(),
                    "total": 1,
                    "pending": 0,
                    "confirmed": 0,
                    "waiting": 0,
                    "inProgress": 0,
                    "completed": 0,
                    "cancelled": 1,
                },
            ],
        )
        self.assertEqual(
            payload["appointmentsByDoctor"],
            [
                {
                    "date": self.start_date.isoformat(),
                    "doctorId": self.doctor.id,
                    "total": 2,
                    "completed": 1,
                    "cancelled": 0,
                },
                {
                    "date": self.end_date.isoformat(),
                    "doctorId": self.second_doctor.id,
                    "total": 1,
                    "completed": 0,
                    "cancelled": 1,
                },
            ],
        )
        self.assertEqual(
            payload["employees"],
            {
                "total": 4,
                "active": 2,
                "locked": 1,
                "doctors": 2,
                "receptionists": 1,
                "managers": 1,
            },
        )
        self.assertEqual(
            payload["organization"],
            {"departments": 1, "rooms": 1},
        )

    def test_snapshot_excludes_personal_and_clinical_data(self):
        response = self._get_snapshot()
        serialized = response.content.decode()

        self.assertNotIn("Private Patient Name", serialized)
        self.assertNotIn("Private Doctor Name", serialized)
        self.assertNotIn("0900999999", serialized)
        self.assertNotIn("Private Address", serialized)
        self.assertNotIn("Private appointment reason", serialized)

from datetime import date, datetime, timedelta
from datetime import timezone as datetime_timezone

import jwt
from django.test import TestCase, override_settings

from reports.models import (
    DailyAppointmentStatistic,
    DailyDoctorStatistic,
    SynchronizationRun,
    SystemSummary,
)

TEST_JWT_KEY = "reporting-api-test-jwt-key-at-least-32-bytes"


@override_settings(CORE_JWT_SIGNING_KEY=TEST_JWT_KEY)
class ReportingReadApiTests(TestCase):
    date_from = date(2026, 8, 12)
    date_to = date(2026, 8, 13)

    @classmethod
    def setUpTestData(cls):
        synchronized_at = datetime(2026, 8, 13, 10, 30, tzinfo=datetime_timezone.utc)
        DailyAppointmentStatistic.objects.create(
            date=cls.date_from,
            total=5,
            pending=1,
            confirmed=1,
            waiting=1,
            in_progress=0,
            completed=2,
            synchronized_at=synchronized_at,
        )
        DailyAppointmentStatistic.objects.create(
            date=cls.date_to,
            total=7,
            pending=0,
            confirmed=1,
            waiting=1,
            in_progress=1,
            completed=3,
            cancelled=1,
            synchronized_at=synchronized_at,
        )
        DailyDoctorStatistic.objects.create(
            date=cls.date_to,
            doctor_id=42,
            total=4,
            completed=3,
            cancelled=1,
            synchronized_at=synchronized_at,
        )
        SystemSummary.objects.create(
            snapshot_date=cls.date_to,
            employee_total=16,
            active_employees=14,
            locked_employees=2,
            doctor_total=10,
            receptionist_total=4,
            manager_total=2,
            department_total=5,
            room_total=12,
            synchronized_at=synchronized_at,
        )
        SystemSummary.objects.create(
            snapshot_date=cls.date_to + timedelta(days=1),
            employee_total=18,
            active_employees=17,
            locked_employees=1,
            doctor_total=11,
            receptionist_total=5,
            manager_total=2,
            department_total=6,
            room_total=14,
            synchronized_at=synchronized_at + timedelta(days=1),
        )
        cls.successful_run = SynchronizationRun.objects.create(
            status=SynchronizationRun.Status.SUCCESS,
            date_from=cls.date_from,
            date_to=cls.date_to,
            started_at=synchronized_at - timedelta(minutes=1),
            finished_at=synchronized_at,
        )
        cls.failed_run = SynchronizationRun.objects.create(
            status=SynchronizationRun.Status.FAILED,
            date_from=cls.date_from,
            date_to=cls.date_to,
            started_at=synchronized_at + timedelta(minutes=1),
            finished_at=synchronized_at + timedelta(minutes=2),
            error_message="Clinic Core unavailable",
        )

    def token(self, role="MANAGER"):
        return jwt.encode(
            {
                "user_id": "7",
                "role": role,
                "token_type": "access",
                "exp": datetime.now(datetime_timezone.utc) + timedelta(minutes=5),
            },
            TEST_JWT_KEY,
            algorithm="HS256",
        )

    def get(self, path, *, role="MANAGER"):
        return self.client.get(
            path,
            HTTP_AUTHORIZATION=f"Bearer {self.token(role)}",
        )

    @property
    def query(self):
        return f"dateFrom={self.date_from}&dateTo={self.date_to}"

    def test_manager_dashboard_aggregates_reporting_read_models(self):
        response = self.get(f"/api/reports/dashboard/manager/?{self.query}")

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(
            data["period"],
            {"dateFrom": "2026-08-12", "dateTo": "2026-08-13"},
        )
        self.assertEqual(
            data["appointments"],
            {"total": 12, "completed": 5, "cancelled": 1},
        )
        self.assertEqual(
            data["employees"],
            {"total": 18, "active": 17, "locked": 1},
        )
        self.assertEqual(data["organization"], {"departments": 6, "rooms": 14})
        self.assertEqual(len(data["dailyAppointments"]), 2)
        self.assertEqual(data["lastSynchronizedAt"], "2026-08-13T10:30:00Z")

    def test_appointment_report_filters_and_orders_daily_rows(self):
        response = self.get(f"/api/reports/appointments/?{self.query}")

        self.assertEqual(response.status_code, 200)
        items = response.json()["data"]["items"]
        self.assertEqual([item["date"] for item in items], ["2026-08-12", "2026-08-13"])
        self.assertEqual(items[1]["inProgress"], 1)

    def test_doctor_report_returns_core_ids_without_user_data(self):
        response = self.get(f"/api/reports/doctors/?{self.query}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["data"]["items"][0],
            {
                "date": "2026-08-13",
                "doctorId": 42,
                "total": 4,
                "completed": 3,
                "cancelled": 1,
                "synchronizedAt": "2026-08-13T10:30:00Z",
            },
        )

    def test_latest_synchronization_exposes_latest_attempt(self):
        response = self.get("/api/reports/synchronizations/latest/")

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["id"], str(self.failed_run.id))
        self.assertEqual(data["status"], "FAILED")
        self.assertEqual(data["errorMessage"], "Clinic Core unavailable")

    def test_read_apis_require_manager_access_token(self):
        paths = [
            "/api/reports/dashboard/manager/",
            "/api/reports/appointments/",
            "/api/reports/doctors/",
            "/api/reports/synchronizations/latest/",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)
                self.assertEqual(self.get(path, role="DOCTOR").status_code, 403)

    def test_date_range_validation_is_shared_by_read_apis(self):
        response = self.get(
            "/api/reports/appointments/?dateFrom=2026-08-14&dateTo=2026-08-13"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")


@override_settings(CORE_JWT_SIGNING_KEY=TEST_JWT_KEY)
class EmptyReportingReadApiTests(TestCase):
    def token(self):
        return jwt.encode(
            {
                "user_id": "7",
                "role": "MANAGER",
                "token_type": "access",
                "exp": datetime.now(datetime_timezone.utc) + timedelta(minutes=5),
            },
            TEST_JWT_KEY,
            algorithm="HS256",
        )

    def test_empty_dashboard_returns_zeros_and_latest_returns_null(self):
        authorization = f"Bearer {self.token()}"
        dashboard = self.client.get(
            "/api/reports/dashboard/manager/?dateFrom=2026-08-01&dateTo=2026-08-13",
            HTTP_AUTHORIZATION=authorization,
        )
        latest = self.client.get(
            "/api/reports/synchronizations/latest/",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(
            dashboard.json()["data"]["appointments"],
            {"total": 0, "completed": 0, "cancelled": 0},
        )
        self.assertIsNone(dashboard.json()["data"]["lastSynchronizedAt"])
        self.assertIsNone(latest.json()["data"])

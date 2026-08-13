import json
from datetime import date, datetime, timedelta
from datetime import timezone as datetime_timezone
from io import StringIO
from unittest.mock import patch

import jwt
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError
from django.test import TestCase, override_settings

from reports.models import (
    DailyAppointmentStatistic,
    DailyDoctorStatistic,
    SynchronizationRun,
    SystemSummary,
)
from reports.services.synchronize import SynchronizationError, synchronize_reports

TEST_JWT_KEY = "reporting-test-jwt-key-at-least-32-bytes"


def snapshot(date_from, date_to, *, total=2):
    return {
        "generatedAt": "2026-08-13T10:30:00Z",
        "period": {
            "dateFrom": date_from.isoformat(),
            "dateTo": date_to.isoformat(),
        },
        "appointmentsByDate": [
            {
                "date": date_to.isoformat(),
                "total": total,
                "pending": 0,
                "confirmed": 1 if total else 0,
                "waiting": 0,
                "inProgress": 0,
                "completed": 1 if total > 1 else 0,
                "cancelled": max(total - 2, 0),
            }
        ],
        "appointmentsByDoctor": [
            {
                "date": date_to.isoformat(),
                "doctorId": 12,
                "total": total,
                "completed": 1 if total > 1 else 0,
                "cancelled": max(total - 2, 0),
            }
        ],
        "employees": {
            "total": 4,
            "active": 3,
            "locked": 1,
            "doctors": 2,
            "receptionists": 1,
            "managers": 1,
        },
        "organization": {"departments": 2, "rooms": 3},
    }


class SynchronizationServiceTests(TestCase):
    date_from = date(2026, 8, 1)
    date_to = date(2026, 8, 13)

    @patch("reports.services.synchronize.fetch_core_snapshot")
    def test_repeated_sync_upserts_without_duplicate_statistics(self, fetch):
        fetch.return_value = snapshot(self.date_from, self.date_to)

        first = synchronize_reports(date_from=self.date_from, date_to=self.date_to)
        fetch.return_value = snapshot(self.date_from, self.date_to, total=3)
        second = synchronize_reports(date_from=self.date_from, date_to=self.date_to)

        self.assertEqual(first.status, SynchronizationRun.Status.SUCCESS)
        self.assertEqual(second.status, SynchronizationRun.Status.SUCCESS)
        self.assertEqual(SynchronizationRun.objects.count(), 2)
        self.assertEqual(DailyAppointmentStatistic.objects.count(), 1)
        self.assertEqual(DailyDoctorStatistic.objects.count(), 1)
        self.assertEqual(SystemSummary.objects.count(), 1)
        self.assertEqual(DailyAppointmentStatistic.objects.get().total, 3)

    @patch("reports.services.synchronize.fetch_core_snapshot")
    def test_sync_removes_stale_rows_inside_requested_range(self, fetch):
        stale_date = self.date_from + timedelta(days=1)
        DailyAppointmentStatistic.objects.create(date=stale_date)
        DailyDoctorStatistic.objects.create(date=stale_date, doctor_id=99)
        fetch.return_value = snapshot(self.date_from, self.date_to)

        synchronize_reports(date_from=self.date_from, date_to=self.date_to)

        self.assertFalse(
            DailyAppointmentStatistic.objects.filter(date=stale_date).exists()
        )
        self.assertFalse(
            DailyDoctorStatistic.objects.filter(
                date=stale_date,
                doctor_id=99,
            ).exists()
        )

    @patch("reports.services.synchronize.fetch_core_snapshot")
    def test_invalid_snapshot_rolls_back_data_and_records_failed_run(self, fetch):
        invalid = snapshot(self.date_from, self.date_to)
        invalid["appointmentsByDate"][0]["total"] = 99
        fetch.return_value = invalid

        with self.assertRaises((SynchronizationError, IntegrityError)):
            synchronize_reports(date_from=self.date_from, date_to=self.date_to)

        self.assertFalse(DailyAppointmentStatistic.objects.exists())
        run = SynchronizationRun.objects.get()
        self.assertEqual(run.status, SynchronizationRun.Status.FAILED)
        self.assertIsNotNone(run.finished_at)
        self.assertTrue(run.error_message)


@override_settings(CORE_JWT_SIGNING_KEY=TEST_JWT_KEY)
class SynchronizationApiTests(TestCase):
    url = "/api/reports/synchronize/"
    date_from = date(2026, 8, 1)
    date_to = date(2026, 8, 13)

    def token(self, role="MANAGER", *, token_type="access"):
        now = datetime.now(datetime_timezone.utc)
        return jwt.encode(
            {
                "user_id": "7",
                "role": role,
                "token_type": token_type,
                "exp": now + timedelta(minutes=5),
            },
            TEST_JWT_KEY,
            algorithm="HS256",
        )

    @patch("reports.api.views.synchronize_reports")
    def test_manager_can_start_manual_synchronization(self, synchronize):
        run = SynchronizationRun.objects.create(
            status=SynchronizationRun.Status.SUCCESS,
            date_from=self.date_from,
            date_to=self.date_to,
            finished_at=datetime.now(datetime_timezone.utc),
        )
        synchronize.return_value = run

        response = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "dateFrom": self.date_from.isoformat(),
                    "dateTo": self.date_to.isoformat(),
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token()}",
        )

        self.assertEqual(response.status_code, 200)
        synchronize.assert_called_once_with(
            date_from=self.date_from,
            date_to=self.date_to,
        )

    def test_rejects_missing_token_non_manager_and_refresh_token(self):
        missing = self.client.post(self.url, data="{}", content_type="application/json")
        doctor = self.client.post(
            self.url,
            data="{}",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token('DOCTOR')}",
        )
        refresh = self.client.post(
            self.url,
            data="{}",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token(token_type='refresh')}",
        )

        self.assertEqual(missing.status_code, 401)
        self.assertEqual(doctor.status_code, 403)
        self.assertEqual(refresh.status_code, 401)


class SynchronizationCommandTests(TestCase):
    @patch("reports.management.commands.sync_reports.synchronize_reports")
    def test_command_uses_requested_number_of_days(self, synchronize):
        today = date(2026, 8, 13)
        run = SynchronizationRun(
            id=9,
            status=SynchronizationRun.Status.SUCCESS,
            date_from=today - timedelta(days=29),
            date_to=today,
        )
        synchronize.return_value = run

        with patch(
            "reports.management.commands.sync_reports.timezone.localdate",
            return_value=today,
        ):
            call_command("sync_reports", days=30, stdout=StringIO())

        synchronize.assert_called_once_with(
            date_from=today - timedelta(days=29),
            date_to=today,
        )

    def test_command_rejects_invalid_days(self):
        with self.assertRaises(CommandError):
            call_command("sync_reports", days=0)

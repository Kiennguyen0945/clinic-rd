from datetime import date

from django.db import IntegrityError, transaction
from django.test import TestCase

from reports.models import (
    DailyAppointmentStatistic,
    DailyDoctorStatistic,
    SynchronizationRun,
    SystemSummary,
)


class ReportingModelTests(TestCase):
    report_date = date(2026, 8, 13)

    def test_synchronization_run_defaults_to_running(self):
        run = SynchronizationRun.objects.create(
            date_from=self.report_date,
            date_to=self.report_date,
        )

        self.assertEqual(run.status, SynchronizationRun.Status.RUNNING)
        self.assertIsNone(run.finished_at)
        self.assertEqual(run.error_message, "")

    def test_synchronization_run_rejects_reversed_range(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            SynchronizationRun.objects.create(
                date_from=date(2026, 8, 14),
                date_to=self.report_date,
            )

    def test_daily_appointment_date_is_unique_and_statuses_equal_total(self):
        DailyAppointmentStatistic.objects.create(
            date=self.report_date,
            total=3,
            pending=1,
            completed=1,
            cancelled=1,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            DailyAppointmentStatistic.objects.create(date=self.report_date)

        with self.assertRaises(IntegrityError), transaction.atomic():
            DailyAppointmentStatistic.objects.create(
                date=date(2026, 8, 14),
                total=1,
                completed=2,
            )

    def test_daily_doctor_uses_plain_identifier_and_composite_uniqueness(self):
        statistic = DailyDoctorStatistic.objects.create(
            date=self.report_date,
            doctor_id=42,
            total=3,
            completed=2,
            cancelled=1,
        )

        self.assertEqual(statistic.doctor_id, 42)
        self.assertFalse(hasattr(statistic, "doctor"))

        with self.assertRaises(IntegrityError), transaction.atomic():
            DailyDoctorStatistic.objects.create(
                date=self.report_date,
                doctor_id=42,
            )

    def test_system_summary_date_is_unique(self):
        SystemSummary.objects.create(snapshot_date=self.report_date)

        with self.assertRaises(IntegrityError), transaction.atomic():
            SystemSummary.objects.create(snapshot_date=self.report_date)

"""Read-only queries over Reporting-owned projections."""

from django.db.models import Sum

from reports.models import (
    DailyAppointmentStatistic,
    DailyDoctorStatistic,
    SynchronizationRun,
    SystemSummary,
)


def appointment_statistics(*, date_from, date_to):
    return DailyAppointmentStatistic.objects.filter(
        date__range=(date_from, date_to)
    ).order_by("date")


def doctor_statistics(*, date_from, date_to):
    return DailyDoctorStatistic.objects.filter(
        date__range=(date_from, date_to)
    ).order_by("date", "doctor_id")


def system_summary_at(*, snapshot_date):
    return (
        SystemSummary.objects.filter(snapshot_date__lte=snapshot_date)
        .order_by("-snapshot_date")
        .first()
    )


def latest_system_summary():
    return SystemSummary.objects.order_by("-snapshot_date").first()


def latest_synchronization():
    return SynchronizationRun.objects.order_by("-started_at", "-id").first()


def manager_dashboard(*, date_from, date_to):
    daily = appointment_statistics(date_from=date_from, date_to=date_to)
    totals = daily.aggregate(
        total=Sum("total"),
        completed=Sum("completed"),
        cancelled=Sum("cancelled"),
    )
    # Employee and organization counts describe the current clinic structure,
    # not the historical appointment period selected on the dashboard.
    summary = latest_system_summary()
    last_success = (
        SynchronizationRun.objects.filter(
            status=SynchronizationRun.Status.SUCCESS,
            finished_at__isnull=False,
        )
        .order_by("-finished_at", "-id")
        .first()
    )

    return {
        "daily": list(daily),
        "totals": {key: value or 0 for key, value in totals.items()},
        "summary": summary,
        "last_synchronized_at": last_success.finished_at if last_success else None,
    }

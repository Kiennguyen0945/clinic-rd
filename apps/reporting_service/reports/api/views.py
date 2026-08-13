"""HTTP views owned by the Reporting Service."""

import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from reports.authentication import ManagerAuthenticationError, authenticate_manager
from reports.selectors.dashboard_queries import (
    appointment_statistics,
    doctor_statistics,
    latest_synchronization,
    manager_dashboard,
)
from reports.services.synchronize import SynchronizationError, synchronize_reports

from .serializers import DateRangeSerializer, SynchronizationInputSerializer


@require_GET
def health_check(request):
    """Report process availability without depending on Clinic Core."""
    return JsonResponse({"status": "healthy", "service": "reporting-service"})


def _authentication_error(request):
    try:
        authenticate_manager(request)
    except ManagerAuthenticationError as exc:
        return JsonResponse(
            {
                "error": {
                    "code": "FORBIDDEN"
                    if exc.status_code == 403
                    else "UNAUTHORIZED",
                    "message": str(exc),
                }
            },
            status=exc.status_code,
        )
    return None


def _validated_date_range(request):
    serializer = DateRangeSerializer(data=request.GET)
    if serializer.is_valid():
        return serializer.validated_data, None
    return None, JsonResponse(
        {
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Khoảng thời gian không hợp lệ",
                "details": serializer.errors,
            }
        },
        status=400,
    )


def _iso_datetime(value):
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def _daily_appointment_data(statistic):
    return {
        "date": statistic.date.isoformat(),
        "total": statistic.total,
        "pending": statistic.pending,
        "confirmed": statistic.confirmed,
        "waiting": statistic.waiting,
        "inProgress": statistic.in_progress,
        "completed": statistic.completed,
        "cancelled": statistic.cancelled,
        "synchronizedAt": _iso_datetime(statistic.synchronized_at),
    }


def _daily_doctor_data(statistic):
    return {
        "date": statistic.date.isoformat(),
        "doctorId": statistic.doctor_id,
        "total": statistic.total,
        "completed": statistic.completed,
        "cancelled": statistic.cancelled,
        "synchronizedAt": _iso_datetime(statistic.synchronized_at),
    }


@csrf_exempt
def synchronize(request):
    if request.method != "POST":
        return JsonResponse({"error": {"code": "METHOD_NOT_ALLOWED"}}, status=405)

    auth_error = _authentication_error(request)
    if auth_error is not None:
        return auth_error

    try:
        payload = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse(
            {"error": {"code": "VALIDATION_ERROR", "message": "JSON không hợp lệ"}},
            status=400,
        )

    serializer = SynchronizationInputSerializer(data=payload)
    if not serializer.is_valid():
        return JsonResponse(
            {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Khoảng thời gian không hợp lệ",
                    "details": serializer.errors,
                }
            },
            status=400,
        )

    try:
        run = synchronize_reports(**serializer.validated_data)
    except SynchronizationError as exc:
        return JsonResponse(
            {"error": {"code": "SYNCHRONIZATION_FAILED", "message": str(exc)}},
            status=502,
        )

    return JsonResponse(
        {
            "success": True,
            "data": {
                "runId": str(run.id),
                "status": run.status,
                "dateFrom": run.date_from.isoformat(),
                "dateTo": run.date_to.isoformat(),
                "finishedAt": run.finished_at.isoformat(),
            },
        }
    )


@require_GET
def manager_dashboard_report(request):
    auth_error = _authentication_error(request)
    if auth_error is not None:
        return auth_error
    period, validation_error = _validated_date_range(request)
    if validation_error is not None:
        return validation_error

    dashboard = manager_dashboard(**period)
    summary = dashboard["summary"]
    return JsonResponse(
        {
            "success": True,
            "data": {
                "period": {
                    "dateFrom": period["date_from"].isoformat(),
                    "dateTo": period["date_to"].isoformat(),
                },
                "appointments": dashboard["totals"],
                "employees": {
                    "total": summary.employee_total if summary else 0,
                    "active": summary.active_employees if summary else 0,
                    "locked": summary.locked_employees if summary else 0,
                },
                "organization": {
                    "departments": summary.department_total if summary else 0,
                    "rooms": summary.room_total if summary else 0,
                },
                "dailyAppointments": [
                    _daily_appointment_data(row) for row in dashboard["daily"]
                ],
                "lastSynchronizedAt": _iso_datetime(
                    dashboard["last_synchronized_at"]
                ),
            },
        }
    )


@require_GET
def appointment_report(request):
    auth_error = _authentication_error(request)
    if auth_error is not None:
        return auth_error
    period, validation_error = _validated_date_range(request)
    if validation_error is not None:
        return validation_error

    statistics = appointment_statistics(**period)
    return JsonResponse(
        {
            "success": True,
            "data": {
                "period": {
                    "dateFrom": period["date_from"].isoformat(),
                    "dateTo": period["date_to"].isoformat(),
                },
                "items": [_daily_appointment_data(row) for row in statistics],
            },
        }
    )


@require_GET
def doctor_report(request):
    auth_error = _authentication_error(request)
    if auth_error is not None:
        return auth_error
    period, validation_error = _validated_date_range(request)
    if validation_error is not None:
        return validation_error

    statistics = doctor_statistics(**period)
    return JsonResponse(
        {
            "success": True,
            "data": {
                "period": {
                    "dateFrom": period["date_from"].isoformat(),
                    "dateTo": period["date_to"].isoformat(),
                },
                "items": [_daily_doctor_data(row) for row in statistics],
            },
        }
    )


@require_GET
def latest_synchronization_report(request):
    auth_error = _authentication_error(request)
    if auth_error is not None:
        return auth_error

    run = latest_synchronization()
    data = None
    if run is not None:
        data = {
            "id": str(run.id),
            "status": run.status,
            "dateFrom": run.date_from.isoformat(),
            "dateTo": run.date_to.isoformat(),
            "startedAt": _iso_datetime(run.started_at),
            "finishedAt": _iso_datetime(run.finished_at),
            "errorMessage": run.error_message,
        }
    return JsonResponse({"success": True, "data": data})

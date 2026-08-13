"""Thin internal HTTP adapter for reporting snapshots."""

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .authentication import has_valid_service_token
from .snapshot import build_reporting_snapshot
from .validation import SnapshotRangeError, validate_snapshot_range


def _error_response(code, message, *, status, details=None):
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return JsonResponse({"error": error}, status=status)


@require_GET
def reporting_snapshot(request):
    if not has_valid_service_token(request):
        return _error_response(
            "UNAUTHORIZED",
            "Thông tin xác thực dịch vụ không hợp lệ",
            status=401,
        )

    try:
        snapshot_range = validate_snapshot_range(
            request.GET.get("dateFrom"),
            request.GET.get("dateTo"),
        )
    except SnapshotRangeError as exc:
        return _error_response(
            "VALIDATION_ERROR",
            exc.message,
            status=400,
            details=exc.details,
        )

    return JsonResponse(
        build_reporting_snapshot(
            date_from=snapshot_range.date_from,
            date_to=snapshot_range.date_to,
        )
    )

"""HTTP views owned by the Reporting Service."""

import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from reports.authentication import ManagerAuthenticationError, authenticate_manager
from reports.services.synchronize import SynchronizationError, synchronize_reports

from .serializers import SynchronizationInputSerializer


@require_GET
def health_check(request):
    """Report process availability without depending on Clinic Core."""
    return JsonResponse({"status": "healthy", "service": "reporting-service"})


@csrf_exempt
def synchronize(request):
    if request.method != "POST":
        return JsonResponse({"error": {"code": "METHOD_NOT_ALLOWED"}}, status=405)

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

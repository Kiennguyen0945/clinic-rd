"""HTTP views owned by the Reporting Service."""

from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health_check(request):
    """Report process availability without depending on Clinic Core."""
    return JsonResponse({"status": "healthy", "service": "reporting-service"})

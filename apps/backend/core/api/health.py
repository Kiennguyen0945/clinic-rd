"""Health endpoint for the Clinic Core process."""

from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health_check(request):
    """Report that the HTTP process is ready to receive requests."""
    return JsonResponse({"status": "healthy", "service": "clinic-core"})

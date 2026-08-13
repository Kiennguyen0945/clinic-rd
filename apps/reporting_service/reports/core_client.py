"""HTTP client for Clinic Core's private reporting contract."""

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings


class CoreSnapshotError(RuntimeError):
    pass


def fetch_core_snapshot(*, date_from, date_to):
    if not settings.INTERNAL_SERVICE_TOKEN:
        raise CoreSnapshotError("INTERNAL_SERVICE_TOKEN is not configured")

    query = urllib.parse.urlencode(
        {"dateFrom": date_from.isoformat(), "dateTo": date_to.isoformat()}
    )
    request = urllib.request.Request(
        f"{settings.CLINIC_CORE_URL}/api/internal/reporting/snapshot/?{query}",
        headers={"X-Service-Token": settings.INTERNAL_SERVICE_TOKEN},
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=settings.CORE_HTTP_TIMEOUT_SECONDS,
        ) as response:
            return json.load(response)
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
        raise CoreSnapshotError("Không thể lấy snapshot từ Clinic Core") from exc

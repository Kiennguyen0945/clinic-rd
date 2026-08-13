"""Root routes owned by the Reporting Service."""

from django.urls import include, path

from reports.api.views import health_check

urlpatterns = [
    path("health/", health_check, name="reporting-health"),
    path("api/reports/", include("reports.api.urls")),
]

from django.urls import path

from .views import reporting_snapshot

urlpatterns = [
    path("snapshot/", reporting_snapshot, name="internal-reporting-snapshot"),
]

"""Root URL configuration."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("auth_service.urls")),
    path("api/", include("patient_service.urls")),
    path("api/", include("appointments.api.urls")),
    path("api/", include("medical_records.urls")),
]

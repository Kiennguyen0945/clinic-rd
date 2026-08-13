"""Reporting API routes added after the service boundary is established."""

from django.urls import path

from .views import (
    appointment_report,
    doctor_report,
    latest_synchronization_report,
    manager_dashboard_report,
    synchronize,
)

urlpatterns = [
    path("synchronize/", synchronize, name="reporting-synchronize"),
    path("dashboard/manager/", manager_dashboard_report, name="manager-dashboard"),
    path("appointments/", appointment_report, name="appointment-report"),
    path("doctors/", doctor_report, name="doctor-report"),
    path(
        "synchronizations/latest/",
        latest_synchronization_report,
        name="latest-synchronization",
    ),
]

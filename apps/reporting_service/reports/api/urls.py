"""Reporting API routes added after the service boundary is established."""

from django.urls import path

from .views import synchronize

urlpatterns = [
    path("synchronize/", synchronize, name="reporting-synchronize"),
]

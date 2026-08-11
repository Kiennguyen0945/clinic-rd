"""Backward-compatible URL entrypoint for the patient API."""

from .api.urls import urlpatterns

__all__ = ["urlpatterns"]

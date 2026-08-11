"""Backward-compatible URL entrypoint for the medical-record API."""

from .api.urls import urlpatterns

__all__ = ["urlpatterns"]

"""Backward-compatible URL entrypoint for the auth API."""

from .api.urls import urlpatterns

__all__ = ["urlpatterns"]

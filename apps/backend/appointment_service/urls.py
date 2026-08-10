"""Backward-compatible URL entrypoint for the appointment API."""

from .api.urls import urlpatterns

__all__ = ['urlpatterns']

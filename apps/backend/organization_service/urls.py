"""Backward-compatible URL entrypoint for the organization API."""

from .api.urls import urlpatterns

__all__ = ["urlpatterns"]

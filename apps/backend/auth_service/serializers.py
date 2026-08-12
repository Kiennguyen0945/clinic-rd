"""Backward-compatible exports for auth API serializers."""

from .api.serializers import RoleSerializer, UserSerializer

__all__ = ["RoleSerializer", "UserSerializer"]

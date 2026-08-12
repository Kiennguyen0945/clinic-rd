"""Backward-compatible import path for auth API views."""

import sys

from .api import views as _api_views

sys.modules[__name__] = _api_views

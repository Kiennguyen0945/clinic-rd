"""Backward-compatible import path for appointment API views.

New code should import from :mod:`appointment_service.api.views`.
"""

import sys

from .api import views as _api_views

# Keep patching/introspection of ``appointment_service.views`` compatible with
# the historical module by exposing the API implementation module itself.
sys.modules[__name__] = _api_views

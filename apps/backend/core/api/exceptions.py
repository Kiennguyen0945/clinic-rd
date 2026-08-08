"""Domain-independent API exceptions."""

from rest_framework.exceptions import APIException


class ApiError(APIException):
    """An API exception with a stable machine-readable error code."""

    status_code = 400
    default_detail = "Yêu cầu không hợp lệ"
    default_code = "API_ERROR"

    def __init__(self, detail=None, *, code=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail=detail, code=code)

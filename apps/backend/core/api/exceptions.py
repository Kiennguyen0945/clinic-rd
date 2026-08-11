from rest_framework.exceptions import APIException


class APIError(APIException):
    """Base exception for errors using the shared API error envelope."""

    status_code = 400
    default_code = "API_ERROR"
    default_detail = "The request could not be completed."

    def __init__(self, message=None, *, code=None, details=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code

        error = {
            "code": code or self.default_code,
            "message": message or self.default_detail,
        }
        if details is not None:
            error["details"] = details

        super().__init__({"success": False, "error": error}, code=code)

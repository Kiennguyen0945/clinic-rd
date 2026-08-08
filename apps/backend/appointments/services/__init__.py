"""Write use cases for the appointments domain."""


class AppointmentServiceError(Exception):
    """Expected business-rule failure returned by an appointment use case."""

    def __init__(self, code, message, *, status=400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details

class AuthServiceError(Exception):
    """An authentication workflow failure rendered by the API layer."""

    def __init__(self, code, message, *, status=400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details

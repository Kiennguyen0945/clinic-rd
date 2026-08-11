class MedicalRecordServiceError(Exception):
    """A workflow failure that the API layer can render consistently."""

    def __init__(self, code, message, *, status=400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details

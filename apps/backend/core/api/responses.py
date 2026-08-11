from rest_framework.response import Response


def success_response(data, message="Thành công", status=200):
    return Response(
        {"success": True, "data": data, "message": message},
        status=status,
    )


def error_response(code, message, status=400, details=None):
    error_body = {"code": code, "message": message}
    if details is not None:
        error_body["details"] = details

    return Response({"success": False, "error": error_body}, status=status)

from ..models import Role


def list_roles():
    return Role.objects.all()


def get_role_by_code(code):
    try:
        return Role.objects.get(code=code)
    except Role.DoesNotExist:
        return None

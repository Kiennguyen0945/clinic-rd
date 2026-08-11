from ..models import User


def list_users():
    return User.objects.all()


def get_user_by_username(username):
    try:
        return User.objects.select_related("role").get(username=username)
    except User.DoesNotExist:
        return None


def get_user(user_id):
    try:
        return User.objects.select_related("role").get(pk=user_id)
    except User.DoesNotExist:
        return None

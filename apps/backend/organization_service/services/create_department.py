from django.db import transaction

from ..models import Department


@transaction.atomic
def create_department(*, code: str, name: str, description: str | None = None) -> Department:
    return Department.objects.create(
        code=code.strip().upper(),
        name=name.strip(),
        description=description.strip() if description else None,
    )

from django.db import transaction

from ..models import Room


@transaction.atomic
def create_room(
    *, room_number: str, department=None, doctor=None, description: str = ""
) -> Room:
    return Room.objects.create(
        room_number=room_number.strip(),
        department=department,
        doctor=doctor,
        description=description.strip(),
    )

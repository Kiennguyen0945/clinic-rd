from django.db import transaction

from ..models import Room


@transaction.atomic
def create_room(*, room_number: str) -> Room:
    return Room.objects.create(room_number=room_number.strip())

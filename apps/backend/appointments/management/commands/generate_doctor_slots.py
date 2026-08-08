from django.core.management.base import BaseCommand

from appointments.tasks import generate_doctor_slots


class Command(BaseCommand):
    help = 'Tạo doctorSlot cho 60 ngày lịch kể từ hôm nay.'

    def handle(self, *args, **options):
        created = generate_doctor_slots()
        self.stdout.write(self.style.SUCCESS(f'Đã tạo {created} doctorSlot mới.'))

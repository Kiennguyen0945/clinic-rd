from django.core.management.base import BaseCommand

from appointment_service.tasks import cancel_confirmed_no_shows


class Command(BaseCommand):
    help = 'Huỷ lịch CONFIRMED của hôm nay và các ngày trước với lý do NO_SHOW.'

    def handle(self, *args, **options):
        cancelled = cancel_confirmed_no_shows()
        self.stdout.write(self.style.SUCCESS(f'Đã huỷ {cancelled} lịch CONFIRMED quá giờ.'))

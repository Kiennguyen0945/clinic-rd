from django.core.management.base import BaseCommand

from appointment_service.tasks import cancel_expired_waiting


class Command(BaseCommand):
    help = 'Huỷ lịch WAITING của hôm nay và các ngày trước với lý do EXPIRED.'

    def handle(self, *args, **options):
        cancelled = cancel_expired_waiting()
        self.stdout.write(self.style.SUCCESS(f'Đã huỷ {cancelled} lịch WAITING hết hạn.'))

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from reports.services.synchronize import SynchronizationError, synchronize_reports


class Command(BaseCommand):
    help = "Synchronize recent reporting aggregates from Clinic Core."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30)

    def handle(self, *args, **options):
        days = options["days"]
        if not 1 <= days <= 366:
            raise CommandError("--days must be between 1 and 366")

        date_to = timezone.localdate()
        date_from = date_to - timedelta(days=days - 1)
        try:
            run = synchronize_reports(date_from=date_from, date_to=date_to)
        except SynchronizationError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Synchronization {run.id} succeeded for {date_from} to {date_to}"
            )
        )

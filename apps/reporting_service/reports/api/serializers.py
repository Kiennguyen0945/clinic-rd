"""Validation for Reporting API inputs."""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers


class DateRangeSerializer(serializers.Serializer):
    dateFrom = serializers.DateField(required=False)
    dateTo = serializers.DateField(required=False)

    def validate(self, attrs):
        date_to = attrs.get("dateTo", timezone.localdate())
        date_from = attrs.get("dateFrom", date_to - timedelta(days=29))
        if date_from > date_to:
            raise serializers.ValidationError(
                {"dateTo": "Không được trước dateFrom"}
            )
        if (date_to - date_from).days + 1 > 366:
            raise serializers.ValidationError(
                {"dateRange": "Khoảng thời gian tối đa là 366 ngày"}
            )
        return {"date_from": date_from, "date_to": date_to}


class SynchronizationInputSerializer(DateRangeSerializer):
    pass

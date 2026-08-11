from datetime import date

from django.db.models import Q, QuerySet

from ..models import Patient


def _years_ago(years: int) -> date:
    today = date.today()  # noqa: DTZ011
    try:
        return today.replace(year=today.year - years)
    except ValueError:
        return today.replace(year=today.year - years, day=28)


def patients(
    *,
    keyword: str = "",
    gender: str = "",
    age_group: str = "",
) -> QuerySet[Patient]:
    queryset = Patient.objects.order_by("-created_at")
    if keyword:
        queryset = queryset.filter(
            Q(patient_code__icontains=keyword)
            | Q(full_name__icontains=keyword)
            | Q(phone__icontains=keyword)
            | Q(email__icontains=keyword)
            | Q(cccd__icontains=keyword)
        )
    if gender in {"M", "F", "O"}:
        queryset = queryset.filter(gender=gender)
    if age_group == "under30":
        queryset = queryset.filter(dob__gt=_years_ago(30))
    elif age_group == "30to40":
        queryset = queryset.filter(
            dob__lte=_years_ago(30),
            dob__gt=_years_ago(41),
        )
    elif age_group == "over40":
        queryset = queryset.filter(dob__lte=_years_ago(41))
    return queryset


def patient_by_id(patient_id: int) -> Patient:
    return Patient.objects.get(pk=patient_id)

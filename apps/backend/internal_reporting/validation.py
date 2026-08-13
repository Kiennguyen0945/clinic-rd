"""Input validation for internal reporting contracts."""

from dataclasses import dataclass
from datetime import date

MAX_SNAPSHOT_DAYS = 366


class SnapshotRangeError(ValueError):
    def __init__(self, message, *, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


@dataclass(frozen=True)
class SnapshotRange:
    date_from: date
    date_to: date


def _parse_iso_date(value, field_name):
    if not value:
        raise SnapshotRangeError(
            "Thiếu khoảng thời gian báo cáo",
            details={field_name: "Trường này là bắt buộc"},
        )
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise SnapshotRangeError(
            "Khoảng thời gian không hợp lệ",
            details={field_name: "Phải có định dạng YYYY-MM-DD"},
        ) from exc
    if parsed.isoformat() != value:
        raise SnapshotRangeError(
            "Khoảng thời gian không hợp lệ",
            details={field_name: "Phải có định dạng YYYY-MM-DD"},
        )
    return parsed


def validate_snapshot_range(date_from_value, date_to_value):
    date_from = _parse_iso_date(date_from_value, "dateFrom")
    date_to = _parse_iso_date(date_to_value, "dateTo")

    if date_from > date_to:
        raise SnapshotRangeError(
            "Khoảng thời gian không hợp lệ",
            details={"dateTo": "Không được trước dateFrom"},
        )

    inclusive_days = (date_to - date_from).days + 1
    if inclusive_days > MAX_SNAPSHOT_DAYS:
        raise SnapshotRangeError(
            "Khoảng thời gian quá lớn",
            details={"dateRange": f"Tối đa {MAX_SNAPSHOT_DAYS} ngày"},
        )

    return SnapshotRange(date_from=date_from, date_to=date_to)

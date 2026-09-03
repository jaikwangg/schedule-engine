import pytest
from datetime import datetime, date, time
from app.domain.services.conflict_engine import (
    is_overlapping,
    check_working_hours_containment,
    find_overlapping_exceptions,
    find_overlapping_schedules,
    generate_day_slots
)

class MockWorkingHour:
    def __init__(self, day, start, end, active=True):
        self.day_of_week = day
        self.start_time = start
        self.end_time = end
        self.is_active = active

class MockException:
    def __init__(self, id, exc_type, start, end, reason=""):
        self.id = id
        self.exception_type = exc_type
        self.start_at = start
        self.end_at = end
        self.reason = reason

class MockSchedule:
    def __init__(self, id, start, end, status="CONFIRMED", priority=100, source_type="BOOKING", source_id="1"):
        self.id = id
        self.start_at = start
        self.end_at = end
        self.status = status
        self.priority = priority
        self.source_type = source_type
        self.source_id = source_id
        self.metadata = {}

def test_is_overlapping_cases():
    t1 = datetime(2026, 9, 2, 9, 0)
    t2 = datetime(2026, 9, 2, 10, 0)
    t3 = datetime(2026, 9, 2, 11, 0)
    t4 = datetime(2026, 9, 2, 12, 0)

    # Completely disjoint
    assert not is_overlapping(t1, t2, t3, t4)
    # Adjacent (Touch boundary) - should NOT overlap
    assert not is_overlapping(t1, t2, t2, t3)
    # Partial overlap
    assert is_overlapping(t1, t3, t2, t4)
    # Complete containment
    assert is_overlapping(t1, t4, t2, t3)

def test_working_hours_containment():
    wh_list = [
        MockWorkingHour(0, time(8, 0), time(17, 0)), # Monday 08:00 - 17:00
        MockWorkingHour(2, time(9, 0), time(18, 0))  # Wednesday 09:00 - 18:00
    ]

    # Wednesday (2026-09-02 is Wednesday, weekday=2)
    valid_time = (datetime(2026, 9, 2, 10, 0), datetime(2026, 9, 2, 12, 0))
    too_early = (datetime(2026, 9, 2, 7, 30), datetime(2026, 9, 2, 10, 0))
    too_late = (datetime(2026, 9, 2, 16, 0), datetime(2026, 9, 2, 19, 0))

    assert check_working_hours_containment(valid_time[0], valid_time[1], wh_list)
    assert not check_working_hours_containment(too_early[0], too_early[1], wh_list)
    assert not check_working_hours_containment(too_late[0], too_late[1], wh_list)

def test_slot_generation_with_exceptions_and_schedules():
    target_date = date(2026, 9, 2) # Wednesday
    wh_list = [MockWorkingHour(2, time(9, 0), time(13, 0))] # 09:00 - 13:00

    # Maintenance at 10:00 - 11:00
    exceptions = [
        MockException("exc-1", "MAINTENANCE", datetime(2026, 9, 2, 10, 0), datetime(2026, 9, 2, 11, 0))
    ]

    # Existing schedule at 11:30 - 12:30
    schedules = [
        MockSchedule("sch-1", datetime(2026, 9, 2, 11, 30), datetime(2026, 9, 2, 12, 30))
    ]

    slots = generate_day_slots(
        target_date=target_date,
        working_hours_list=wh_list,
        exceptions=exceptions,
        existing_schedules=schedules,
        slot_duration_minutes=60,
        step_minutes=30
    )

    # Generated slots:
    # 09:00-10:00 -> Available
    # 09:30-10:30 -> Blocked (overlaps with maintenance 10:00-11:00)
    # 10:00-11:00 -> Blocked (maintenance)
    # 10:30-11:30 -> Blocked (maintenance 10:00-11:00)
    # 11:00-12:00 -> Blocked (overlaps with schedule 11:30-12:30)
    # 12:00-13:00 -> Blocked (overlaps with schedule 11:30-12:30)

    assert len(slots) > 0
    slot_09_00 = next(s for s in slots if "09:00:00" in s["start_at"])
    assert slot_09_00["is_available"] is True

    slot_10_00 = next(s for s in slots if "10:00:00" in s["start_at"])
    assert slot_10_00["is_available"] is False
    assert any("MAINTENANCE" in r for r in slot_10_00["conflict_reasons"])

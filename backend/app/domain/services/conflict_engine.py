from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from app.domain.models import TimeInterval

def is_overlapping(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """
    Returns True if interval A overlaps with interval B.
    Overlap condition: A.start < B.end AND A.end > B.start
    """
    return a_start < b_end and a_end > b_start

def check_working_hours_containment(
    start_at: datetime,
    end_at: datetime,
    working_hours_list: List[Any]
) -> bool:
    """
    Check if the requested [start_at, end_at] completely falls inside
    at least one active working hour period for that day of week.
    """
    if start_at.date() != end_at.date():
        # Multi-day interval must span valid working hours (or handled as separate slots)
        return False

    req_day = start_at.weekday() # 0 = Monday, 6 = Sunday
    req_start_time = start_at.time()
    req_end_time = end_at.time()

    for wh in working_hours_list:
        if wh.day_of_week == req_day and wh.is_active:
            if wh.start_time <= req_start_time and req_end_time <= wh.end_time:
                return True

    return False

def find_overlapping_exceptions(
    start_at: datetime,
    end_at: datetime,
    exceptions: List[Any]
) -> List[Dict[str, Any]]:
    """
    Find any blackout/maintenance/holiday exceptions overlapping with the requested interval.
    """
    matched = []
    for exc in exceptions:
        if is_overlapping(start_at, end_at, exc.start_at, exc.end_at):
            matched.append({
                "id": str(exc.id),
                "type": exc.exception_type,
                "start_at": exc.start_at.isoformat(),
                "end_at": exc.end_at.isoformat(),
                "reason": exc.reason
            })
    return matched

def find_overlapping_schedules(
    start_at: datetime,
    end_at: datetime,
    existing_schedules: List[Any],
    exclude_schedule_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Find all existing active/confirmed/planned schedules overlapping with the requested interval.
    """
    conflicts = []
    active_statuses = {"CONFIRMED", "IN_PROGRESS", "PLANNED", "TENTATIVE"}
    
    for sch in existing_schedules:
        if exclude_schedule_id and str(sch.id) == str(exclude_schedule_id):
            continue
        if sch.status in active_statuses:
            if is_overlapping(start_at, end_at, sch.start_at, sch.end_at):
                conflicts.append({
                    "id": str(sch.id),
                    "status": sch.status,
                    "priority": sch.priority,
                    "source_type": sch.source_type,
                    "source_id": sch.source_id,
                    "start_at": sch.start_at.isoformat(),
                    "end_at": sch.end_at.isoformat(),
                    "metadata": sch.metadata_json if hasattr(sch, "metadata_json") else sch.metadata
                })
    return conflicts

def generate_day_slots(
    target_date: date,
    working_hours_list: List[Any],
    exceptions: List[Any],
    existing_schedules: List[Any],
    slot_duration_minutes: int = 60,
    step_minutes: int = 30
) -> List[Dict[str, Any]]:
    """
    Generate all time slots for a given date, evaluating availability,
    exceptions (maintenance/holidays), and existing schedules.
    """
    day_weekday = target_date.weekday()
    day_wh = [wh for wh in working_hours_list if wh.day_of_week == day_weekday and wh.is_active]
    
    slots = []
    if not day_wh:
        return slots

    slot_delta = timedelta(minutes=slot_duration_minutes)
    step_delta = timedelta(minutes=step_minutes)

    for wh in day_wh:
        wh_start = datetime.combine(target_date, wh.start_time)
        wh_end = datetime.combine(target_date, wh.end_time)

        curr_start = wh_start
        while curr_start + slot_delta <= wh_end:
            curr_end = curr_start + slot_delta

            # 1. Check Exceptions (Maintenance, Holiday, etc.)
            exc_conflicts = find_overlapping_exceptions(curr_start, curr_end, exceptions)
            
            # 2. Check Existing Schedules
            sch_conflicts = find_overlapping_schedules(curr_start, curr_end, existing_schedules)

            is_available = (len(exc_conflicts) == 0) and (len(sch_conflicts) == 0)

            slots.append({
                "start_at": curr_start.isoformat(),
                "end_at": curr_end.isoformat(),
                "is_available": is_available,
                "duration_minutes": slot_duration_minutes,
                "conflict_reasons": [f"Exception: {e['type']} ({e.get('reason','')})" for e in exc_conflicts] +
                                    [f"Allocated: {s['source_type']} ({s['status']})" for s in sch_conflicts]
            })

            curr_start += step_delta

    return slots

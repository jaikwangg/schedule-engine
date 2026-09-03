from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel

class SlotQuery(BaseModel):
    resource_id: str
    target_date: date
    duration_minutes: int = 60
    step_minutes: int = 30

class TimeSlotOut(BaseModel):
    start_at: str
    end_at: str
    is_available: bool
    duration_minutes: int
    conflict_reasons: List[str] = []

class DayAvailabilityResponse(BaseModel):
    resource_id: str
    target_date: str
    day_of_week: int
    slots: List[TimeSlotOut]

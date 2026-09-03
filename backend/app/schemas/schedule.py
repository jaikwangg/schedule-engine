from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.domain.models import ScheduleStatus, SourceType

class ScheduleBase(BaseModel):
    resource_id: str
    start_at: datetime
    end_at: datetime
    priority: int = 100
    source_type: SourceType
    source_id: str
    metadata_json: Optional[Dict[str, Any]] = None

class ScheduleCreate(ScheduleBase):
    status: Optional[ScheduleStatus] = ScheduleStatus.CONFIRMED

class ScheduleUpdate(BaseModel):
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    status: Optional[ScheduleStatus] = None
    priority: Optional[int] = None
    metadata_json: Optional[Dict[str, Any]] = None

class ScheduleConflictCheckRequest(BaseModel):
    resource_id: str
    start_at: datetime
    end_at: datetime
    exclude_schedule_id: Optional[str] = None
    ignore_working_hours: bool = False

class ConflictDetail(BaseModel):
    id: str
    conflict_type: str # 'SCHEDULE' | 'EXCEPTION' | 'OUTSIDE_WORKING_HOURS'
    start_at: str
    end_at: str
    title: str
    description: Optional[str] = None

class ScheduleConflictCheckResponse(BaseModel):
    is_valid: bool
    conflicts: List[ConflictDetail] = []
    message: str

class ScheduleOut(ScheduleBase):
    id: str
    status: ScheduleStatus
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TimelineItem(BaseModel):
    id: str
    resource_id: str
    resource_code: str
    resource_name: str
    title: str
    start_at: datetime
    end_at: datetime
    status: str
    item_type: str # 'SCHEDULE' | 'EXCEPTION'
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    priority: Optional[int] = 100
    metadata: Optional[Dict[str, Any]] = None

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.domain.models import BookingStatus, ApprovalStatus
from app.schemas.schedule import ScheduleOut

class BookingCreate(BaseModel):
    resource_id: str
    start_at: datetime
    end_at: datetime
    requester_name: str
    requester_dept: Optional[str] = None
    purpose: str

class BookingApprovalAction(BaseModel):
    approver_id: str
    approver_name: str
    status: ApprovalStatus # APPROVED or REJECTED
    comment: Optional[str] = None

class BookingApprovalOut(BaseModel):
    id: str
    approver_id: str
    approver_name: str
    stage_order: int
    status: ApprovalStatus
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class BookingOut(BaseModel):
    id: str
    booking_code: str
    schedule_id: Optional[str] = None
    requester_id: str
    requester_name: str
    requester_dept: Optional[str] = None
    purpose: str
    status: BookingStatus
    created_at: datetime
    updated_at: datetime
    schedule: Optional[ScheduleOut] = None
    approvals: List[BookingApprovalOut] = []

    model_config = ConfigDict(from_attributes=True)

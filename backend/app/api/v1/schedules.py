from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleOut,
    ScheduleConflictCheckRequest, ScheduleConflictCheckResponse,
    TimelineItem
)
from app.services.scheduling_service import SchedulingService
from app.services.availability_service import AvailabilityService

router = APIRouter(prefix="/schedules", tags=["Schedule Engine & Timeline"])

@router.post("", response_model=ScheduleOut, status_code=201)
async def allocate_schedule(
    data: ScheduleCreate,
    bypass_conflict: bool = Query(False, description="Force allocate ignoring non-blocking conflicts"),
    db: AsyncSession = Depends(get_db)
):
    """
    Allocate a new schedule slot for a resource.
    Guarantees conflict detection and prevent race conditions.
    """
    return await SchedulingService.allocate_schedule(
        db=db,
        data=data,
        bypass_conflict_check=bypass_conflict
    )

@router.post("/check-conflict", response_model=ScheduleConflictCheckResponse)
async def check_schedule_conflict(
    data: ScheduleConflictCheckRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Simulate and detect any scheduling conflicts before creating/updating.
    Checks: Working hours, Maintenance/Holiday Exceptions, Existing Schedules.
    """
    res = await AvailabilityService.check_conflicts(
        db=db,
        resource_id=data.resource_id,
        start_at=data.start_at,
        end_at=data.end_at,
        exclude_schedule_id=data.exclude_schedule_id,
        ignore_working_hours=data.ignore_working_hours
    )
    return ScheduleConflictCheckResponse(**res)

@router.get("/timeline", response_model=List[TimelineItem])
async def get_timeline(
    start_at: Optional[datetime] = Query(None, description="Start range (default: beginning of current week)"),
    end_at: Optional[datetime] = Query(None, description="End range (default: 7 days later)"),
    resource_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch aggregated timeline blocks (Schedules + Exceptions) across resources.
    Powers the Timeline / Gantt UI.
    """
    now = datetime.utcnow()
    effective_start = start_at or (now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday()))
    effective_end = end_at or (effective_start + timedelta(days=7))

    return await SchedulingService.get_timeline_items(
        db=db,
        start_at=effective_start,
        end_at=effective_end,
        resource_id=resource_id,
        resource_type=resource_type
    )

@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    return await SchedulingService.get_schedule_by_id(db, schedule_id)

@router.patch("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db)
):
    return await SchedulingService.update_schedule(db, schedule_id, data)

@router.delete("/{schedule_id}", response_model=ScheduleOut)
async def cancel_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    return await SchedulingService.cancel_schedule(db, schedule_id)

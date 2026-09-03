from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.availability import DayAvailabilityResponse, TimeSlotOut
from app.services.availability_service import AvailabilityService

router = APIRouter(prefix="/availability", tags=["Availability Engine"])

@router.get("/slots", response_model=DayAvailabilityResponse)
async def get_available_slots(
    resource_id: str = Query(..., description="Target Resource ID"),
    target_date: date = Query(..., description="Date (YYYY-MM-DD)"),
    duration_minutes: int = Query(60, description="Required duration in minutes", ge=15, le=480),
    step_minutes: int = Query(30, description="Step increment in minutes", ge=15, le=120),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate dynamic available slots for a resource on a specific day.
    Subtracts working hour boundaries, holidays, maintenance exceptions, and existing allocations.
    """
    slots_data = await AvailabilityService.get_day_slots(
        db=db,
        resource_id=resource_id,
        target_date=target_date,
        duration_minutes=duration_minutes,
        step_minutes=step_minutes
    )

    return DayAvailabilityResponse(
        resource_id=resource_id,
        target_date=target_date.isoformat(),
        day_of_week=target_date.weekday(),
        slots=[TimeSlotOut(**s) for s in slots_data]
    )

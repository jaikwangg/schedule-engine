from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.usage import UsageClockIn, UsageClockOut, UsageOut
from app.services.usage_service import UsageService

router = APIRouter(prefix="/usages", tags=["Actual Usage & Costing"])

@router.get("", response_model=List[UsageOut])
async def list_usages(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    return await UsageService.list_usages(db, limit=limit)

@router.post("/clock-in", response_model=UsageOut, status_code=201)
async def clock_in_usage(
    data: UsageClockIn,
    db: AsyncSession = Depends(get_db)
):
    """
    Clock-in actual usage on a resource (optionally linked to a schedule).
    """
    return await UsageService.clock_in(db, data)

@router.post("/{usage_id}/clock-out", response_model=UsageOut)
async def clock_out_usage(
    usage_id: str,
    data: UsageClockOut,
    db: AsyncSession = Depends(get_db)
):
    """
    Clock-out actual usage, calculates duration variance, and generates usage cost record.
    """
    return await UsageService.clock_out(db, usage_id, data)

@router.get("/{usage_id}", response_model=UsageOut)
async def get_usage(usage_id: str, db: AsyncSession = Depends(get_db)):
    return await UsageService.get_usage_by_id(db, usage_id)

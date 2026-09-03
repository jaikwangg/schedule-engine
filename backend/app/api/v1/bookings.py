from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.booking import BookingCreate, BookingOut, BookingApprovalAction
from app.services.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["Booking & Approval Lifecycle"])

@router.get("", response_model=List[BookingOut])
async def list_bookings(
    status: Optional[str] = Query(None, description="Filter by status (e.g. REQUESTED, CONFIRMED, REJECTED)"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    return await BookingService.list_bookings(db, status_filter=status, limit=limit)

@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a new booking. 
    Allocates a tentative schedule to hold the slot and puts booking in 'REQUESTED' state.
    """
    return await BookingService.create_booking(db, data)

@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: str, db: AsyncSession = Depends(get_db)):
    return await BookingService.get_booking_by_id(db, booking_id)

@router.post("/{booking_id}/approval", response_model=BookingOut)
async def approve_or_reject_booking(
    booking_id: str,
    action: BookingApprovalAction,
    db: AsyncSession = Depends(get_db)
):
    """
    Approve or reject a pending booking request.
    When APPROVED -> Booking and Schedule become CONFIRMED.
    When REJECTED -> Booking becomes REJECTED and Schedule is CANCELLED (slot freed).
    """
    return await BookingService.process_approval(db, booking_id, action)

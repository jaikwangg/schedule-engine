import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.infrastructure.models import Booking, BookingApproval, Schedule, Resource
from app.schemas.booking import BookingCreate, BookingApprovalAction
from app.schemas.schedule import ScheduleCreate
from app.services.scheduling_service import SchedulingService

class BookingService:
    @staticmethod
    def generate_booking_code() -> str:
        date_str = datetime.utcnow().strftime("%Y%m%d")
        rand_str = uuid.uuid4().hex[:5].upper()
        return f"BK-{date_str}-{rand_str}"

    @classmethod
    async def create_booking(cls, db: AsyncSession, data: BookingCreate) -> Booking:
        # 1. Allocate a Schedule with status 'TENTATIVE' or 'PLANNED' to reserve the slot
        booking_code = cls.generate_booking_code()
        
        schedule_in = ScheduleCreate(
            resource_id=data.resource_id,
            start_at=data.start_at,
            end_at=data.end_at,
            priority=100,
            source_type="BOOKING",
            source_id=booking_code,
            status="TENTATIVE",
            metadata_json={
                "requester_name": data.requester_name,
                "purpose": data.purpose
            }
        )
        
        # This will automatically check availability and prevent double booking
        schedule = await SchedulingService.allocate_schedule(db, schedule_in)

        # 2. Create Booking Entity
        new_booking = Booking(
            booking_code=booking_code,
            schedule_id=schedule.id,
            requester_id=str(uuid.uuid4()),
            requester_name=data.requester_name,
            requester_dept=data.requester_dept,
            purpose=data.purpose,
            status="REQUESTED"
        )
        db.add(new_booking)
        await db.commit()
        await db.refresh(new_booking)

        # Reload with relations
        return await cls.get_booking_by_id(db, new_booking.id)

    @staticmethod
    async def get_booking_by_id(db: AsyncSession, booking_id: str) -> Booking:
        stmt = (
            select(Booking)
            .options(selectinload(Booking.schedule), selectinload(Booking.approvals))
            .where(Booking.id == booking_id)
        )
        booking = (await db.scalars(stmt)).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking '{booking_id}' not found"
            )
        return booking

    @classmethod
    async def process_approval(
        cls,
        db: AsyncSession,
        booking_id: str,
        action: BookingApprovalAction
    ) -> Booking:
        booking = await cls.get_booking_by_id(db, booking_id)
        
        if booking.status not in ["REQUESTED", "PENDING_APPROVAL"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot process approval for booking in status '{booking.status}'"
            )

        # Record approval decision
        approval = BookingApproval(
            booking_id=booking.id,
            approver_id=action.approver_id,
            approver_name=action.approver_name,
            status=action.status,
            comment=action.comment,
            decided_at=datetime.utcnow()
        )
        db.add(approval)

        if action.status == "APPROVED":
            booking.status = "CONFIRMED"
            # Confirm underlying schedule
            if booking.schedule:
                booking.schedule.status = "CONFIRMED"
        else:
            booking.status = "REJECTED"
            # Cancel underlying schedule so slot is freed up
            if booking.schedule:
                booking.schedule.status = "CANCELLED"

        await db.commit()
        await db.refresh(booking)
        return await cls.get_booking_by_id(db, booking.id)

    @classmethod
    async def list_bookings(
        cls,
        db: AsyncSession,
        status_filter: Optional[str] = None,
        limit: int = 50
    ) -> List[Booking]:
        stmt = (
            select(Booking)
            .options(selectinload(Booking.schedule), selectinload(Booking.approvals))
            .order_by(Booking.created_at.desc())
            .limit(limit)
        )
        if status_filter:
            stmt = stmt.where(Booking.status == status_filter)
        
        return (await db.scalars(stmt)).all()

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.infrastructure.models import ResourceUsage, UsageCost, Schedule, Resource
from app.schemas.usage import UsageClockIn, UsageClockOut

class UsageService:
    @staticmethod
    async def clock_in(db: AsyncSession, data: UsageClockIn) -> ResourceUsage:
        # Check resource
        res = await db.get(Resource, data.resource_id)
        if not res:
            raise HTTPException(status_code=404, detail="Resource not found")

        # Create usage record
        usage = ResourceUsage(
            schedule_id=data.schedule_id,
            resource_id=data.resource_id,
            actual_start_at=data.actual_start_at or datetime.utcnow(),
            meter_start=data.meter_start or Decimal("0.0"),
            operator_id=data.operator_id,
            telemetry_data=data.telemetry_data or {}
        )
        db.add(usage)

        # If linked to a schedule, update schedule to IN_PROGRESS
        if data.schedule_id:
            sch = await db.get(Schedule, data.schedule_id)
            if sch:
                sch.status = "IN_PROGRESS"

        await db.commit()
        await db.refresh(usage)
        return await UsageService.get_usage_by_id(db, usage.id)

    @staticmethod
    async def clock_out(
        db: AsyncSession,
        usage_id: str,
        data: UsageClockOut
    ) -> ResourceUsage:
        usage = await db.get(ResourceUsage, usage_id)
        if not usage:
            raise HTTPException(status_code=404, detail="Usage record not found")
        if usage.actual_end_at is not None:
            raise HTTPException(status_code=400, detail="Usage record has already clocked out")

        end_time = data.actual_end_at or datetime.utcnow()
        usage.actual_end_at = end_time
        if data.meter_end is not None:
            usage.meter_end = data.meter_end

        # Calculate duration in minutes
        delta = end_time - usage.actual_start_at
        duration_minutes = max(1, int(delta.total_seconds() / 60))
        usage.actual_duration_minutes = duration_minutes

        if data.telemetry_data:
            curr_tele = usage.telemetry_data or {}
            curr_tele.update(data.telemetry_data)
            usage.telemetry_data = curr_tele

        # Compute Cost
        hourly_rate = data.hourly_rate or Decimal("500.00")
        setup_cost = data.setup_cost or Decimal("0.0")
        duration_hours = Decimal(str(duration_minutes)) / Decimal("60.0")
        total_cost = (duration_hours * hourly_rate) + setup_cost

        cost_record = UsageCost(
            usage_id=usage.id,
            hourly_rate=hourly_rate,
            setup_cost=setup_cost,
            total_cost=total_cost,
            billing_company_id=data.billing_company_id or "COM-DEFAULT",
            charging_company_id=data.charging_company_id or "COM-DEFAULT",
            status="CALCULATED"
        )
        db.add(cost_record)

        # Update schedule to COMPLETED
        if usage.schedule_id:
            sch = await db.get(Schedule, usage.schedule_id)
            if sch:
                sch.status = "COMPLETED"

        await db.commit()
        await db.refresh(usage)
        return await UsageService.get_usage_by_id(db, usage.id)

    @staticmethod
    async def get_usage_by_id(db: AsyncSession, usage_id: str) -> ResourceUsage:
        stmt = (
            select(ResourceUsage)
            .options(selectinload(ResourceUsage.cost))
            .where(ResourceUsage.id == usage_id)
        )
        usage = (await db.scalars(stmt)).first()
        if not usage:
            raise HTTPException(status_code=404, detail="Usage not found")
        return usage

    @staticmethod
    async def list_usages(db: AsyncSession, limit: int = 50) -> List[ResourceUsage]:
        stmt = (
            select(ResourceUsage)
            .options(selectinload(ResourceUsage.cost))
            .order_by(ResourceUsage.actual_start_at.desc())
            .limit(limit)
        )
        return (await db.scalars(stmt)).all()

from datetime import date, datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.infrastructure.models import Resource, ResourceWorkingHours, ResourceException, Schedule
from app.domain.services.conflict_engine import (
    check_working_hours_containment,
    find_overlapping_exceptions,
    find_overlapping_schedules,
    generate_day_slots
)

class AvailabilityService:
    @staticmethod
    async def get_resource_rules(db: AsyncSession, resource_id: str):
        # Fetch working hours
        wh_stmt = select(ResourceWorkingHours).where(
            ResourceWorkingHours.resource_id == resource_id,
            ResourceWorkingHours.is_active == True
        )
        working_hours = (await db.scalars(wh_stmt)).all()

        # Fetch exceptions (specific to resource OR global exception where resource_id is None)
        exc_stmt = select(ResourceException).where(
            or_(
                ResourceException.resource_id == resource_id,
                ResourceException.resource_id == None
            )
        )
        exceptions = (await db.scalars(exc_stmt)).all()

        return working_hours, exceptions

    @classmethod
    async def get_day_slots(
        cls,
        db: AsyncSession,
        resource_id: str,
        target_date: date,
        duration_minutes: int = 60,
        step_minutes: int = 30
    ) -> List[Dict[str, Any]]:
        working_hours, exceptions = await cls.get_resource_rules(db, resource_id)

        # Fetch schedules on that date (plus buffer for overlapping start/ends)
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())

        sch_stmt = select(Schedule).where(
            Schedule.resource_id == resource_id,
            Schedule.start_at < day_end,
            Schedule.end_at > day_start,
            Schedule.status.in_(["CONFIRMED", "IN_PROGRESS", "PLANNED", "TENTATIVE"])
        )
        schedules = (await db.scalars(sch_stmt)).all()

        return generate_day_slots(
            target_date=target_date,
            working_hours_list=working_hours,
            exceptions=exceptions,
            existing_schedules=schedules,
            slot_duration_minutes=duration_minutes,
            step_minutes=step_minutes
        )

    @classmethod
    async def check_conflicts(
        cls,
        db: AsyncSession,
        resource_id: str,
        start_at: datetime,
        end_at: datetime,
        exclude_schedule_id: Optional[str] = None,
        ignore_working_hours: bool = False
    ) -> Dict[str, Any]:
        conflicts = []
        working_hours, exceptions = await cls.get_resource_rules(db, resource_id)

        # 1. Check Working Hours (if enabled)
        if not ignore_working_hours and working_hours:
            is_in_wh = check_working_hours_containment(start_at, end_at, working_hours)
            if not is_in_wh:
                conflicts.append({
                    "id": "OUTSIDE_HOURS",
                    "conflict_type": "OUTSIDE_WORKING_HOURS",
                    "start_at": start_at.isoformat(),
                    "end_at": end_at.isoformat(),
                    "title": "อยู่นอกเวลาทำการของ Resource",
                    "description": "ช่วงเวลาที่ร้องขอไม่อยู่ในกะทำงานปกติของทรัพยากรนี้"
                })

        # 2. Check Exceptions
        overlapping_exc = find_overlapping_exceptions(start_at, end_at, exceptions)
        for exc in overlapping_exc:
            conflicts.append({
                "id": exc["id"],
                "conflict_type": "EXCEPTION",
                "start_at": exc["start_at"],
                "end_at": exc["end_at"],
                "title": f"ข้อยกเว้น: {exc['type']}",
                "description": exc.get("reason") or "ติดซ่อมบำรุงหรือวันหยุด"
            })

        # 3. Check Existing Active Schedules
        sch_stmt = select(Schedule).where(
            Schedule.resource_id == resource_id,
            Schedule.status.in_(["CONFIRMED", "IN_PROGRESS", "PLANNED", "TENTATIVE"]),
            Schedule.start_at < end_at,
            Schedule.end_at > start_at
        )
        if exclude_schedule_id:
            sch_stmt = sch_stmt.where(Schedule.id != exclude_schedule_id)

        existing_schedules = (await db.scalars(sch_stmt)).all()
        for sch in existing_schedules:
            conflicts.append({
                "id": str(sch.id),
                "conflict_type": "SCHEDULE",
                "start_at": sch.start_at.isoformat(),
                "end_at": sch.end_at.isoformat(),
                "title": f"ตารางชนกับ: {sch.source_type} ({sch.status})",
                "description": f"Source ID: {sch.source_id}, Priority: {sch.priority}"
            })

        is_valid = len(conflicts) == 0
        message = "ช่วงเวลานี้ว่าง สามารถจัดสรรเวลาได้" if is_valid else f"พบข้อขัดแย้ง {len(conflicts)} รายการ"

        return {
            "is_valid": is_valid,
            "conflicts": conflicts,
            "message": message
        }

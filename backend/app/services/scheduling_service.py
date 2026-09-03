from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, delete
from fastapi import HTTPException, status
from app.infrastructure.models import Resource, Schedule, ResourceException
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, TimelineItem
from app.services.availability_service import AvailabilityService

class SchedulingService:
    @staticmethod
    async def allocate_schedule(
        db: AsyncSession,
        data: ScheduleCreate,
        bypass_conflict_check: bool = False
    ) -> Schedule:
        # 1. Fetch resource and verify existence
        stmt = select(Resource).where(Resource.id == data.resource_id)
        resource = (await db.scalars(stmt)).first()
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource with ID '{data.resource_id}' not found"
            )
        if not resource.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Resource '{resource.code}' is currently inactive"
            )

        # 2. Concurrency-safe Conflict Detection
        if not bypass_conflict_check:
            conflict_res = await AvailabilityService.check_conflicts(
                db=db,
                resource_id=data.resource_id,
                start_at=data.start_at,
                end_at=data.end_at
            )
            if not conflict_res["is_valid"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "Schedule allocation conflict detected",
                        "conflicts": conflict_res["conflicts"]
                    }
                )

        # 3. Create Schedule record
        new_schedule = Schedule(
            resource_id=data.resource_id,
            start_at=data.start_at,
            end_at=data.end_at,
            status=data.status or "CONFIRMED",
            priority=data.priority,
            source_type=data.source_type,
            source_id=data.source_id,
            metadata_json=data.metadata_json or {}
        )

        db.add(new_schedule)
        await db.commit()
        await db.refresh(new_schedule)
        return new_schedule

    @staticmethod
    async def get_schedule_by_id(db: AsyncSession, schedule_id: str) -> Schedule:
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        schedule = (await db.scalars(stmt)).first()
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule '{schedule_id}' not found"
            )
        return schedule

    @staticmethod
    async def update_schedule(
        db: AsyncSession,
        schedule_id: str,
        data: ScheduleUpdate
    ) -> Schedule:
        schedule = await SchedulingService.get_schedule_by_id(db, schedule_id)

        target_start = data.start_at or schedule.start_at
        target_end = data.end_at or schedule.end_at

        # If time changed, check conflict excluding this schedule
        if data.start_at or data.end_at:
            conflict_res = await AvailabilityService.check_conflicts(
                db=db,
                resource_id=schedule.resource_id,
                start_at=target_start,
                end_at=target_end,
                exclude_schedule_id=schedule_id
            )
            if not conflict_res["is_valid"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "Schedule update conflict detected",
                        "conflicts": conflict_res["conflicts"]
                    }
                )
            schedule.start_at = target_start
            schedule.end_at = target_end

        if data.status is not None:
            schedule.status = data.status
        if data.priority is not None:
            schedule.priority = data.priority
        if data.metadata_json is not None:
            schedule.metadata_json = data.metadata_json

        schedule.version += 1
        await db.commit()
        await db.refresh(schedule)
        return schedule

    @staticmethod
    async def cancel_schedule(db: AsyncSession, schedule_id: str) -> Schedule:
        schedule = await SchedulingService.get_schedule_by_id(db, schedule_id)
        schedule.status = "CANCELLED"
        schedule.version += 1
        await db.commit()
        await db.refresh(schedule)
        return schedule

    @staticmethod
    async def get_timeline_items(
        db: AsyncSession,
        start_at: datetime,
        end_at: datetime,
        resource_id: Optional[str] = None,
        resource_type: Optional[str] = None
    ) -> List[TimelineItem]:
        items: List[TimelineItem] = []

        # 1. Base Resource Query
        res_stmt = select(Resource).where(Resource.is_active == True)
        if resource_id:
            res_stmt = res_stmt.where(Resource.id == resource_id)
        if resource_type:
            res_stmt = res_stmt.where(Resource.resource_type == resource_type)

        resources = {r.id: r for r in (await db.scalars(res_stmt)).all()}
        if not resources:
            return items

        resource_ids = list(resources.keys())

        # 2. Query Active Schedules
        sch_stmt = select(Schedule).where(
            Schedule.resource_id.in_(resource_ids),
            Schedule.start_at < end_at,
            Schedule.end_at > start_at,
            Schedule.status.in_(["CONFIRMED", "IN_PROGRESS", "PLANNED", "TENTATIVE"])
        ).order_by(Schedule.start_at)

        schedules = (await db.scalars(sch_stmt)).all()
        for s in schedules:
            res = resources.get(s.resource_id)
            if res:
                items.append(TimelineItem(
                    id=str(s.id),
                    resource_id=s.resource_id,
                    resource_code=res.code,
                    resource_name=res.name,
                    title=f"[{s.source_type}] {s.source_id}",
                    start_at=s.start_at,
                    end_at=s.end_at,
                    status=s.status,
                    item_type="SCHEDULE",
                    source_type=s.source_type,
                    source_id=s.source_id,
                    priority=s.priority,
                    metadata=s.metadata_json
                ))

        # 3. Query Resource Exceptions
        exc_stmt = select(ResourceException).where(
            or_(
                ResourceException.resource_id.in_(resource_ids),
                ResourceException.resource_id == None
            ),
            ResourceException.start_at < end_at,
            ResourceException.end_at > start_at
        )
        exceptions = (await db.scalars(exc_stmt)).all()
        for e in exceptions:
            target_r_ids = [e.resource_id] if e.resource_id else resource_ids
            for r_id in target_r_ids:
                res = resources.get(r_id)
                if res:
                    items.append(TimelineItem(
                        id=f"exc-{e.id}-{r_id}",
                        resource_id=r_id,
                        resource_code=res.code,
                        resource_name=res.name,
                        title=f"[MAINTENANCE] {e.reason or e.exception_type}",
                        start_at=e.start_at,
                        end_at=e.end_at,
                        status="BLOCKED",
                        item_type="EXCEPTION",
                        source_type="EXCEPTION",
                        source_id=str(e.id),
                        priority=0,
                        metadata={"exception_type": e.exception_type, "reason": e.reason}
                    ))

        return sorted(items, key=lambda x: x.start_at)

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.infrastructure.models import (
    Resource, ResourceWorkingHours, ResourceException, Schedule, ResourceUsage
)
from app.schemas.resource import (
    ResourceCreate, ResourceUpdate, ResourceOut,
    WorkingHoursCreate, WorkingHoursUpdate, WorkingHoursOut,
    ExceptionCreate, ExceptionUpdate, ExceptionOut
)

router = APIRouter(prefix="/resources", tags=["Resources & Working Hours"])

RESOURCE_EAGER_OPTIONS = (
    selectinload(Resource.working_hours),
    selectinload(Resource.exceptions),
)


async def _get_resource_or_404(resource_id: str, db: AsyncSession) -> Resource:
    """Load a Resource with its working hours + exceptions eagerly, or raise 404."""
    stmt = select(Resource).options(*RESOURCE_EAGER_OPTIONS).where(Resource.id == resource_id)
    resource = (await db.scalars(stmt)).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


async def _assert_code_available(code: str, db: AsyncSession, exclude_id: Optional[str] = None) -> None:
    stmt = select(Resource).where(Resource.code == code)
    if exclude_id:
        stmt = stmt.where(Resource.id != exclude_id)
    if (await db.scalars(stmt)).first():
        raise HTTPException(status_code=400, detail=f"Resource code '{code}' already exists")


# ---------------------------------------------------------------------------
# Resource collection
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ResourceOut])
async def list_resources(
    resource_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_id: Optional[str] = None,
    q: Optional[str] = Query(None, description="Free-text search on code or name"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Resource).options(*RESOURCE_EAGER_OPTIONS).order_by(Resource.code)

    if resource_type:
        stmt = stmt.where(Resource.resource_type == resource_type)
    if is_active is not None:
        stmt = stmt.where(Resource.is_active == is_active)
    if company_id:
        stmt = stmt.where(Resource.company_id == company_id)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(or_(Resource.code.ilike(pattern), Resource.name.ilike(pattern)))

    return (await db.scalars(stmt)).all()


@router.post("", response_model=ResourceOut, status_code=201)
async def create_resource(data: ResourceCreate, db: AsyncSession = Depends(get_db)):
    await _assert_code_available(data.code, db)

    resource = Resource(
        code=data.code,
        name=data.name,
        resource_type=data.resource_type,
        company_id=data.company_id or "COM-01",
        capacity=data.capacity,
        is_active=data.is_active
    )
    db.add(resource)
    await db.flush()

    if data.working_hours:
        for wh in data.working_hours:
            db.add(ResourceWorkingHours(
                resource_id=resource.id,
                day_of_week=wh.day_of_week,
                start_time=wh.start_time,
                end_time=wh.end_time,
                is_active=wh.is_active
            ))

    await db.commit()
    return await _get_resource_or_404(resource.id, db)


# ---------------------------------------------------------------------------
# Exceptions (declared before /{resource_id} so the literal path wins)
# ---------------------------------------------------------------------------

@router.get("/exceptions", response_model=List[ExceptionOut])
async def list_resource_exceptions(
    resource_id: Optional[str] = None,
    exception_type: Optional[str] = None,
    include_global: bool = Query(True, description="Include company-wide exceptions (resource_id = null)"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ResourceException).order_by(ResourceException.start_at.desc())

    if resource_id:
        if include_global:
            stmt = stmt.where(or_(
                ResourceException.resource_id == resource_id,
                ResourceException.resource_id.is_(None)
            ))
        else:
            stmt = stmt.where(ResourceException.resource_id == resource_id)
    if exception_type:
        stmt = stmt.where(ResourceException.exception_type == exception_type)

    return (await db.scalars(stmt)).all()


@router.post("/exceptions", response_model=ExceptionOut, status_code=201)
async def add_resource_exception(
    data: ExceptionCreate,
    db: AsyncSession = Depends(get_db)
):
    if data.resource_id:
        await _get_resource_or_404(data.resource_id, db)

    exc = ResourceException(
        resource_id=data.resource_id,
        exception_type=data.exception_type,
        start_at=data.start_at,
        end_at=data.end_at,
        reason=data.reason
    )
    db.add(exc)
    await db.commit()
    await db.refresh(exc)
    return exc


@router.patch("/exceptions/{exception_id}", response_model=ExceptionOut)
async def update_resource_exception(
    exception_id: str,
    data: ExceptionUpdate,
    db: AsyncSession = Depends(get_db)
):
    exc = await db.get(ResourceException, exception_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exc, field, value)

    if exc.end_at <= exc.start_at:
        raise HTTPException(status_code=422, detail="end_at must be after start_at")

    await db.commit()
    await db.refresh(exc)
    return exc


@router.delete("/exceptions/{exception_id}")
async def delete_resource_exception(
    exception_id: str,
    db: AsyncSession = Depends(get_db)
):
    exc = await db.get(ResourceException, exception_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
    await db.delete(exc)
    await db.commit()
    return {"message": "Exception deleted successfully", "id": exception_id}


# ---------------------------------------------------------------------------
# Working hours addressed by their own id
# ---------------------------------------------------------------------------

@router.patch("/working-hours/{working_hours_id}", response_model=WorkingHoursOut)
async def update_working_hours(
    working_hours_id: str,
    data: WorkingHoursUpdate,
    db: AsyncSession = Depends(get_db)
):
    wh = await db.get(ResourceWorkingHours, working_hours_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Working hours entry not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(wh, field, value)

    if wh.end_time <= wh.start_time:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")

    await db.commit()
    await db.refresh(wh)
    return wh


@router.delete("/working-hours/{working_hours_id}")
async def delete_working_hours(
    working_hours_id: str,
    db: AsyncSession = Depends(get_db)
):
    wh = await db.get(ResourceWorkingHours, working_hours_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Working hours entry not found")
    await db.delete(wh)
    await db.commit()
    return {"message": "Working hours deleted successfully", "id": working_hours_id}


# ---------------------------------------------------------------------------
# Single resource
# ---------------------------------------------------------------------------

@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(resource_id: str, db: AsyncSession = Depends(get_db)):
    return await _get_resource_or_404(resource_id, db)


@router.patch("/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    db: AsyncSession = Depends(get_db)
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    payload = data.model_dump(exclude_unset=True)
    if "code" in payload and payload["code"] != resource.code:
        await _assert_code_available(payload["code"], db, exclude_id=resource_id)

    for field, value in payload.items():
        setattr(resource, field, value)

    await db.commit()
    return await _get_resource_or_404(resource_id, db)


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: str,
    db: AsyncSession = Depends(get_db)
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    code = resource.code

    # Any schedule or recorded usage keeps the resource alive: both FKs are
    # RESTRICT, so a hard delete would orphan those rows.
    has_schedule = (await db.scalars(
        select(Schedule.id).where(Schedule.resource_id == resource_id).limit(1)
    )).first()
    has_usage = (await db.scalars(
        select(ResourceUsage.id).where(ResourceUsage.resource_id == resource_id).limit(1)
    )).first()

    if has_schedule or has_usage:
        # Soft-delete: deactivate instead of hard delete
        resource.is_active = False
        await db.commit()
        return {
            "message": f"Resource '{code}' deactivated (has schedules or usage history)",
            "id": resource_id,
            "action": "deactivated",
        }

    # Hard delete: remove working hours and exceptions first
    await db.execute(delete(ResourceWorkingHours).where(ResourceWorkingHours.resource_id == resource_id))
    await db.execute(delete(ResourceException).where(ResourceException.resource_id == resource_id))
    await db.delete(resource)
    await db.commit()
    return {
        "message": f"Resource '{code}' permanently deleted",
        "id": resource_id,
        "action": "deleted",
    }


# ---------------------------------------------------------------------------
# Working hours nested under a resource
# ---------------------------------------------------------------------------

@router.get("/{resource_id}/working-hours", response_model=List[WorkingHoursOut])
async def list_working_hours(resource_id: str, db: AsyncSession = Depends(get_db)):
    await _get_resource_or_404(resource_id, db)
    stmt = (
        select(ResourceWorkingHours)
        .where(ResourceWorkingHours.resource_id == resource_id)
        .order_by(ResourceWorkingHours.day_of_week, ResourceWorkingHours.start_time)
    )
    return (await db.scalars(stmt)).all()


@router.post("/{resource_id}/working-hours", response_model=WorkingHoursOut, status_code=201)
async def add_working_hours(
    resource_id: str,
    data: WorkingHoursCreate,
    db: AsyncSession = Depends(get_db)
):
    await _get_resource_or_404(resource_id, db)

    duplicate_stmt = select(ResourceWorkingHours).where(
        ResourceWorkingHours.resource_id == resource_id,
        ResourceWorkingHours.day_of_week == data.day_of_week,
        ResourceWorkingHours.start_time == data.start_time,
        ResourceWorkingHours.end_time == data.end_time,
    )
    if (await db.scalars(duplicate_stmt)).first():
        raise HTTPException(status_code=400, detail="An identical working hours entry already exists")

    wh = ResourceWorkingHours(
        resource_id=resource_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        is_active=data.is_active
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


@router.put("/{resource_id}/working-hours", response_model=List[WorkingHoursOut])
async def replace_working_hours(
    resource_id: str,
    data: List[WorkingHoursCreate],
    db: AsyncSession = Depends(get_db)
):
    """Replace the whole weekly template in one call (used by the resource editor)."""
    await _get_resource_or_404(resource_id, db)

    seen = set()
    for wh in data:
        key = (wh.day_of_week, wh.start_time, wh.end_time)
        if key in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate working hours entry for day {wh.day_of_week}"
            )
        seen.add(key)

    await db.execute(
        delete(ResourceWorkingHours).where(ResourceWorkingHours.resource_id == resource_id)
    )
    for wh in data:
        db.add(ResourceWorkingHours(
            resource_id=resource_id,
            day_of_week=wh.day_of_week,
            start_time=wh.start_time,
            end_time=wh.end_time,
            is_active=wh.is_active
        ))
    await db.commit()

    return await list_working_hours(resource_id, db)

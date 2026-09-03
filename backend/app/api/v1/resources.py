from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.infrastructure.models import Resource, ResourceWorkingHours, ResourceException
from app.schemas.resource import (
    ResourceCreate, ResourceUpdate, ResourceOut,
    WorkingHoursCreate, WorkingHoursOut,
    ExceptionCreate, ExceptionOut
)

router = APIRouter(prefix="/resources", tags=["Resources & Working Hours"])

@router.get("", response_model=List[ResourceOut])
async def list_resources(
    resource_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Resource).options(
        selectinload(Resource.working_hours),
        selectinload(Resource.exceptions)
    ).order_by(Resource.code)
    
    if resource_type:
        stmt = stmt.where(Resource.resource_type == resource_type)
    if is_active is not None:
        stmt = stmt.where(Resource.is_active == is_active)
        
    return (await db.scalars(stmt)).all()

@router.post("", response_model=ResourceOut, status_code=201)
async def create_resource(data: ResourceCreate, db: AsyncSession = Depends(get_db)):
    # Check duplicate code
    exist_stmt = select(Resource).where(Resource.code == data.code)
    if (await db.scalars(exist_stmt)).first():
        raise HTTPException(status_code=400, detail=f"Resource code '{data.code}' already exists")

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
            wh_model = ResourceWorkingHours(
                resource_id=resource.id,
                day_of_week=wh.day_of_week,
                start_time=wh.start_time,
                end_time=wh.end_time,
                is_active=wh.is_active
            )
            db.add(wh_model)

    await db.commit()
    
    # Reload
    stmt = select(Resource).options(
        selectinload(Resource.working_hours),
        selectinload(Resource.exceptions)
    ).where(Resource.id == resource.id)
    return (await db.scalars(stmt)).first()

@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(resource_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Resource).options(
        selectinload(Resource.working_hours),
        selectinload(Resource.exceptions)
    ).where(Resource.id == resource_id)
    resource = (await db.scalars(stmt)).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.patch("/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    db: AsyncSession = Depends(get_db)
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if data.name is not None:
        resource.name = data.name
    if data.capacity is not None:
        resource.capacity = data.capacity
    if data.is_active is not None:
        resource.is_active = data.is_active

    await db.commit()
    
    stmt = select(Resource).options(
        selectinload(Resource.working_hours),
        selectinload(Resource.exceptions)
    ).where(Resource.id == resource.id)
    return (await db.scalars(stmt)).first()

@router.post("/{resource_id}/working-hours", response_model=WorkingHoursOut, status_code=201)
async def add_working_hours(
    resource_id: str,
    data: WorkingHoursCreate,
    db: AsyncSession = Depends(get_db)
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

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

@router.post("/exceptions", response_model=ExceptionOut, status_code=201)
async def add_resource_exception(
    data: ExceptionCreate,
    db: AsyncSession = Depends(get_db)
):
    if data.resource_id:
        res = await db.get(Resource, data.resource_id)
        if not res:
            raise HTTPException(status_code=404, detail="Resource not found")

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

from datetime import time, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.domain.models import ResourceType, ExceptionType

# Working Hours Schemas
class WorkingHoursBase(BaseModel):
    day_of_week: int # 0=Mon, 6=Sun
    start_time: time
    end_time: time
    is_active: bool = True

class WorkingHoursCreate(WorkingHoursBase):
    pass

class WorkingHoursOut(WorkingHoursBase):
    id: str
    resource_id: str

    model_config = ConfigDict(from_attributes=True)

# Exception Schemas
class ExceptionBase(BaseModel):
    resource_id: Optional[str] = None
    exception_type: ExceptionType
    start_at: datetime
    end_at: datetime
    reason: Optional[str] = None

class ExceptionCreate(ExceptionBase):
    pass

class ExceptionOut(ExceptionBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Resource Schemas
class ResourceBase(BaseModel):
    code: str
    name: str
    resource_type: ResourceType
    company_id: Optional[str] = None
    capacity: int = 1
    is_active: bool = True

class ResourceCreate(ResourceBase):
    working_hours: Optional[List[WorkingHoursCreate]] = None

class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None

class ResourceOut(ResourceBase):
    id: str
    created_at: datetime
    updated_at: datetime
    working_hours: List[WorkingHoursOut] = []
    exceptions: List[ExceptionOut] = []

    model_config = ConfigDict(from_attributes=True)

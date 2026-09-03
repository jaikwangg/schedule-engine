from datetime import time, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.domain.models import ResourceType, ExceptionType

# Working Hours Schemas
class WorkingHoursBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6) # 0=Mon, 6=Sun
    start_time: time
    end_time: time
    is_active: bool = True

class WorkingHoursCreate(WorkingHoursBase):
    @model_validator(mode="after")
    def check_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self

class WorkingHoursUpdate(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None

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
    @model_validator(mode="after")
    def check_time_range(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self

class ExceptionUpdate(BaseModel):
    exception_type: Optional[ExceptionType] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    reason: Optional[str] = None

class ExceptionOut(ExceptionBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Resource Schemas
class ResourceBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    resource_type: ResourceType
    company_id: Optional[str] = None
    capacity: int = Field(1, ge=1)
    is_active: bool = True

class ResourceCreate(ResourceBase):
    working_hours: Optional[List[WorkingHoursCreate]] = None

class ResourceUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    resource_type: Optional[ResourceType] = None
    company_id: Optional[str] = None
    capacity: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None

class ResourceOut(ResourceBase):
    id: str
    created_at: datetime
    updated_at: datetime
    working_hours: List[WorkingHoursOut] = []
    exceptions: List[ExceptionOut] = []

    model_config = ConfigDict(from_attributes=True)

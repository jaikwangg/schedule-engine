from datetime import datetime
from typing import Optional, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.domain.models import CostStatus

class UsageClockIn(BaseModel):
    schedule_id: Optional[str] = None
    resource_id: str
    actual_start_at: Optional[datetime] = None # Defaults to now
    meter_start: Optional[Decimal] = Decimal("0.0")
    operator_id: Optional[str] = None
    telemetry_data: Optional[Dict[str, Any]] = None

class UsageClockOut(BaseModel):
    actual_end_at: Optional[datetime] = None # Defaults to now
    meter_end: Optional[Decimal] = None
    hourly_rate: Optional[Decimal] = Decimal("500.00")
    setup_cost: Optional[Decimal] = Decimal("0.0")
    billing_company_id: Optional[str] = None
    charging_company_id: Optional[str] = None
    telemetry_data: Optional[Dict[str, Any]] = None

class CostOut(BaseModel):
    id: str
    hourly_rate: Decimal
    setup_cost: Decimal
    total_cost: Decimal
    billing_company_id: str
    charging_company_id: str
    status: CostStatus
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UsageOut(BaseModel):
    id: str
    schedule_id: Optional[str] = None
    resource_id: str
    actual_start_at: datetime
    actual_end_at: Optional[datetime] = None
    actual_duration_minutes: Optional[int] = None
    meter_start: Optional[Decimal] = None
    meter_end: Optional[Decimal] = None
    operator_id: Optional[str] = None
    telemetry_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    cost: Optional[CostOut] = None

    model_config = ConfigDict(from_attributes=True)

import uuid
from datetime import datetime, time
from sqlalchemy import (
    Column, String, Boolean, Integer, Time, DateTime, 
    ForeignKey, Numeric, Text, JSON, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Resource(Base):
    __tablename__ = "resources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, nullable=False, index=True) # e.g. 'CNC-001'
    name = Column(String(255), nullable=False)
    resource_type = Column(String(50), nullable=False, index=True) # 'MACHINE', 'ROOM', 'HUMAN', 'VEHICLE', 'TOOL'
    company_id = Column(String(36), nullable=False, default=generate_uuid)
    capacity = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    working_hours = relationship("ResourceWorkingHours", back_populates="resource", cascade="all, delete-orphan")
    exceptions = relationship("ResourceException", back_populates="resource", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="resource")
    usages = relationship("ResourceUsage", back_populates="resource")

class ResourceWorkingHours(Base):
    __tablename__ = "resource_working_hours"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0 = Mon, 6 = Sun
    start_time = Column(Time, nullable=False)     # e.g. 08:00:00
    end_time = Column(Time, nullable=False)       # e.g. 17:00:00
    is_active = Column(Boolean, default=True)

    resource = relationship("Resource", back_populates="working_hours")

    __table_args__ = (
        UniqueConstraint("resource_id", "day_of_week", "start_time", "end_time", name="uq_resource_wh"),
    )

class ResourceException(Base):
    __tablename__ = "resource_exceptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("resources.id", ondelete="CASCADE"), nullable=True) # None = All resources
    exception_type = Column(String(50), nullable=False) # 'MAINTENANCE', 'HOLIDAY', 'BREAKDOWN', 'RESTRICTED'
    start_at = Column(DateTime, nullable=False, index=True)
    end_at = Column(DateTime, nullable=False, index=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    resource = relationship("Resource", back_populates="exceptions")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_at = Column(DateTime, nullable=False, index=True)
    end_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(30), nullable=False, default="PLANNED", index=True) 
    # 'PLANNED', 'TENTATIVE', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    
    priority = Column(Integer, default=100) # Lower value = higher priority
    source_type = Column(String(50), nullable=False, index=True) 
    # 'BOOKING', 'PRODUCTION_ORDER', 'PROJECT_TASK', 'MAINTENANCE', 'INTERCOMPANY', 'INTERNAL_WORK'
    source_id = Column(String(100), nullable=False, index=True)
    
    metadata_json = Column(JSON, default=dict)
    version = Column(Integer, default=1) # Optimistic locking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resource = relationship("Resource", back_populates="schedules")
    booking = relationship("Booking", back_populates="schedule", uselist=False)
    usage = relationship("ResourceUsage", back_populates="schedule", uselist=False)

    __table_args__ = (
        CheckConstraint("end_at > start_at", name="chk_schedule_time"),
    )

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    booking_code = Column(String(50), unique=True, nullable=False, index=True) # e.g. 'BK-20260902-001'
    schedule_id = Column(String(36), ForeignKey("schedules.id", ondelete="RESTRICT"), unique=True, nullable=True)
    requester_id = Column(String(36), nullable=False, default=generate_uuid)
    requester_name = Column(String(255), nullable=False)
    requester_dept = Column(String(100), nullable=True)
    purpose = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="REQUESTED", index=True)
    # 'DRAFT', 'REQUESTED', 'PENDING_APPROVAL', 'CONFIRMED', 'REJECTED', 'CANCELLED'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    schedule = relationship("Schedule", back_populates="booking")
    approvals = relationship("BookingApproval", back_populates="booking", cascade="all, delete-orphan")

class BookingApproval(Base):
    __tablename__ = "booking_approvals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    booking_id = Column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(String(36), nullable=False)
    approver_name = Column(String(255), nullable=False)
    stage_order = Column(Integer, default=1)
    status = Column(String(30), nullable=False, default="PENDING") # 'PENDING', 'APPROVED', 'REJECTED'
    comment = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)

    booking = relationship("Booking", back_populates="approvals")

class ResourceUsage(Base):
    __tablename__ = "resource_usages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    schedule_id = Column(String(36), ForeignKey("schedules.id", ondelete="SET NULL"), nullable=True)
    resource_id = Column(String(36), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False)
    actual_start_at = Column(DateTime, nullable=False)
    actual_end_at = Column(DateTime, nullable=True)
    actual_duration_minutes = Column(Integer, nullable=True)
    meter_start = Column(Numeric(12, 2), default=0.0)
    meter_end = Column(Numeric(12, 2), nullable=True)
    telemetry_data = Column(JSON, default=dict)
    operator_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    resource = relationship("Resource", back_populates="usages")
    schedule = relationship("Schedule", back_populates="usage")
    cost = relationship("UsageCost", back_populates="usage", uselist=False, cascade="all, delete-orphan")

class UsageCost(Base):
    __tablename__ = "usage_costs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    usage_id = Column(String(36), ForeignKey("resource_usages.id", ondelete="CASCADE"), unique=True, nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=False, default=500.00) # THB/Hour
    setup_cost = Column(Numeric(10, 2), default=0.0)
    total_cost = Column(Numeric(12, 2), nullable=False, default=0.0)
    billing_company_id = Column(String(36), nullable=False, default=generate_uuid)
    charging_company_id = Column(String(36), nullable=False, default=generate_uuid)
    status = Column(String(30), default="CALCULATED") # 'CALCULATED', 'INVOICED', 'SETTLED'
    calculated_at = Column(DateTime, default=datetime.utcnow)

    usage = relationship("ResourceUsage", back_populates="cost")

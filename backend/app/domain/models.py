from enum import Enum
from datetime import datetime
from typing import NamedTuple, Optional

class ResourceType(str, Enum):
    MACHINE = "MACHINE"
    ROOM = "ROOM"
    HUMAN = "HUMAN"
    VEHICLE = "VEHICLE"
    TOOL = "TOOL"

class ScheduleStatus(str, Enum):
    PLANNED = "PLANNED"
    TENTATIVE = "TENTATIVE"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class SourceType(str, Enum):
    BOOKING = "BOOKING"
    PRODUCTION_ORDER = "PRODUCTION_ORDER"
    PROJECT_TASK = "PROJECT_TASK"
    MAINTENANCE = "MAINTENANCE"
    INTERCOMPANY = "INTERCOMPANY"
    INTERNAL_WORK = "INTERNAL_WORK"

class BookingStatus(str, Enum):
    DRAFT = "DRAFT"
    REQUESTED = "REQUESTED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class ExceptionType(str, Enum):
    MAINTENANCE = "MAINTENANCE"
    HOLIDAY = "HOLIDAY"
    BREAKDOWN = "BREAKDOWN"
    RESTRICTED = "RESTRICTED"

class CostStatus(str, Enum):
    CALCULATED = "CALCULATED"
    INVOICED = "INVOICED"
    SETTLED = "SETTLED"

class TimeInterval(NamedTuple):
    start_at: datetime
    end_at: datetime

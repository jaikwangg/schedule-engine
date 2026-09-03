export type ResourceType =
  | 'ROOM'
  | 'PRODUCER'
  | 'COLOR_GRADING_STAFF'
  | 'OPERATOR_UNIT_STAFF'
  | 'DATA_MANAGEMENT_STAFF';
export type ScheduleStatus = 'PLANNED' | 'TENTATIVE' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type SourceType = 'BOOKING' | 'PRODUCTION_ORDER' | 'PROJECT_TASK' | 'MAINTENANCE' | 'INTERCOMPANY' | 'INTERNAL_WORK';
export type BookingStatus = 'DRAFT' | 'REQUESTED' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExceptionType = 'MAINTENANCE' | 'HOLIDAY' | 'BREAKDOWN' | 'RESTRICTED';
export type CostStatus = 'CALCULATED' | 'INVOICED' | 'SETTLED';

export interface WorkingHoursInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface WorkingHours extends WorkingHoursInput {
  id?: string;
  resource_id?: string;
}

export interface ResourceException {
  id: string;
  resource_id?: string | null;
  exception_type: ExceptionType;
  start_at: string;
  end_at: string;
  reason?: string | null;
  created_at?: string;
}

export interface Resource {
  id: string;
  code: string;
  name: string;
  resource_type: ResourceType;
  company_id: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  working_hours?: WorkingHours[];
  exceptions?: ResourceException[];
}

/** Payload for POST /resources */
export interface ResourceInput {
  code: string;
  name: string;
  resource_type: ResourceType;
  company_id?: string;
  capacity?: number;
  is_active?: boolean;
  working_hours?: WorkingHoursInput[];
}

/** Payload for PATCH /resources/{id} — every field is optional */
export type ResourcePatch = Partial<Omit<ResourceInput, 'working_hours'>>;

/** DELETE /resources/{id} either removes the row or just deactivates it */
export interface ResourceDeleteResult {
  message: string;
  id: string;
  action: 'deleted' | 'deactivated';
}

export interface Schedule {
  id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  status: ScheduleStatus;
  priority: number;
  source_type: SourceType;
  source_id: string;
  metadata_json?: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineItem {
  id: string;
  resource_id: string;
  resource_code: string;
  resource_name: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  item_type: 'SCHEDULE' | 'EXCEPTION';
  source_type?: string | null;
  source_id?: string | null;
  priority?: number;
  metadata?: Record<string, any> | null;
}

export interface ConflictDetail {
  id: string;
  conflict_type: 'SCHEDULE' | 'EXCEPTION' | 'OUTSIDE_WORKING_HOURS';
  start_at: string;
  end_at: string;
  title: string;
  description?: string;
}

export interface ConflictCheckResponse {
  is_valid: boolean;
  conflicts: ConflictDetail[];
  message: string;
}

export interface TimeSlot {
  start_at: string;
  end_at: string;
  is_available: boolean;
  duration_minutes: number;
  conflict_reasons: string[];
}

export interface DayAvailability {
  resource_id: string;
  target_date: string;
  day_of_week: number;
  slots: TimeSlot[];
}

export interface BookingApproval {
  id: string;
  approver_id: string;
  approver_name: string;
  stage_order: number;
  status: ApprovalStatus;
  comment?: string | null;
  decided_at?: string | null;
}

export interface Booking {
  id: string;
  booking_code: string;
  schedule_id?: string | null;
  requester_id: string;
  requester_name: string;
  requester_dept?: string | null;
  purpose: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  schedule?: Schedule | null;
  approvals?: BookingApproval[];
}

export interface UsageCost {
  id: string;
  hourly_rate: number;
  setup_cost: number;
  total_cost: number;
  billing_company_id: string;
  charging_company_id: string;
  status: CostStatus;
  calculated_at: string;
}

export interface ResourceUsage {
  id: string;
  schedule_id?: string | null;
  resource_id: string;
  actual_start_at: string;
  actual_end_at?: string | null;
  actual_duration_minutes?: number | null;
  meter_start?: number | null;
  meter_end?: number | null;
  operator_id?: string | null;
  telemetry_data?: Record<string, any> | null;
  created_at: string;
  cost?: UsageCost | null;
}

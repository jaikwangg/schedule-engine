import {
  Resource,
  TimelineItem,
  ConflictCheckResponse,
  DayAvailability,
  Booking,
  ResourceUsage,
  Schedule
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const data = await res.json();
      errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    } catch {
      errorDetail = res.statusText;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  // Health
  checkHealth: async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/', { cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Resources
  getResources: (params?: { resource_type?: string; is_active?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.resource_type) search.append('resource_type', params.resource_type);
    if (params?.is_active !== undefined) search.append('is_active', String(params.is_active));
    return fetcher<Resource[]>(`/resources?${search.toString()}`);
  },

  createResource: (data: Partial<Resource> & { code: string; name: string; resource_type: string }) => {
    return fetcher<Resource>('/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateResource: (resourceId: string, data: { name?: string; capacity?: number; is_active?: boolean }) => {
    return fetcher<Resource>(`/resources/${resourceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  addResourceException: (data: {
    resource_id?: string | null;
    exception_type: string;
    start_at: string;
    end_at: string;
    reason?: string;
  }) => {
    return fetcher('/resources/exceptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteResourceException: (exceptionId: string) => {
    return fetcher(`/resources/exceptions/${exceptionId}`, {
      method: 'DELETE',
    });
  },

  // Schedule Engine & Timeline
  getTimeline: (params?: { start_at?: string; end_at?: string; resource_id?: string; resource_type?: string }) => {
    const search = new URLSearchParams();
    if (params?.start_at) search.append('start_at', params.start_at);
    if (params?.end_at) search.append('end_at', params.end_at);
    if (params?.resource_id) search.append('resource_id', params.resource_id);
    if (params?.resource_type) search.append('resource_type', params.resource_type);
    return fetcher<TimelineItem[]>(`/schedules/timeline?${search.toString()}`);
  },

  allocateSchedule: (data: {
    resource_id: string;
    start_at: string;
    end_at: string;
    priority?: number;
    source_type: string;
    source_id: string;
    status?: string;
    metadata_json?: Record<string, any>;
  }, bypass_conflict = false) => {
    return fetcher<Schedule>(`/schedules?bypass_conflict=${bypass_conflict}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSchedule: (scheduleId: string, data: {
    start_at?: string;
    end_at?: string;
    status?: string;
    priority?: number;
    metadata_json?: Record<string, any>;
  }) => {
    return fetcher<Schedule>(`/schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  checkConflict: (data: {
    resource_id: string;
    start_at: string;
    end_at: string;
    exclude_schedule_id?: string;
    ignore_working_hours?: boolean;
  }) => {
    return fetcher<ConflictCheckResponse>('/schedules/check-conflict', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  cancelSchedule: (scheduleId: string) => {
    return fetcher<Schedule>(`/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },

  // Availability
  getDaySlots: (resourceId: string, targetDate: string, durationMinutes = 60, stepMinutes = 30) => {
    const search = new URLSearchParams({
      resource_id: resourceId,
      target_date: targetDate,
      duration_minutes: String(durationMinutes),
      step_minutes: String(stepMinutes),
    });
    return fetcher<DayAvailability>(`/availability/slots?${search.toString()}`);
  },

  // Bookings
  getBookings: (status?: string) => {
    const search = new URLSearchParams();
    if (status) search.append('status', status);
    return fetcher<Booking[]>(`/bookings?${search.toString()}`);
  },

  createBooking: (data: {
    resource_id: string;
    start_at: string;
    end_at: string;
    requester_name: string;
    requester_dept?: string;
    purpose: string;
  }) => {
    return fetcher<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approveBooking: (bookingId: string, data: {
    approver_id: string;
    approver_name: string;
    status: 'APPROVED' | 'REJECTED';
    comment?: string;
  }) => {
    return fetcher<Booking>(`/bookings/${bookingId}/approval`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Usages & Cost
  getUsages: () => {
    return fetcher<ResourceUsage[]>('/usages');
  },

  clockIn: (data: {
    resource_id: string;
    schedule_id?: string;
    actual_start_at?: string;
    meter_start?: number;
    operator_id?: string;
  }) => {
    return fetcher<ResourceUsage>('/usages/clock-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  clockOut: (usageId: string, data: {
    actual_end_at?: string;
    meter_end?: number;
    hourly_rate?: number;
    setup_cost?: number;
    billing_company_id?: string;
  }) => {
    return fetcher<ResourceUsage>(`/usages/${usageId}/clock-out`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Resource, ResourceType, WorkingHoursInput } from '@/types';
import { api } from '@/lib/api';
import { RESOURCE_TYPE_META } from '@/lib/resourceTypes';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type Notice = { tone: 'success' | 'error'; text: string };

interface ShiftRow extends WorkingHoursInput {
  key: string;
}

const DEFAULT_COMPANY = 'COM-POST-01';

/** "08:00:00" (API) -> "08:00" (<input type="time">) */
const toInputTime = (value: string) => value.slice(0, 5);
/** "08:00" (<input type="time">) -> "08:00:00" (API) */
const toApiTime = (value: string) => (value.length === 5 ? `${value}:00` : value);

let shiftKeySeq = 0;
const makeShift = (day: number, start = '09:00:00', end = '18:00:00'): ShiftRow => ({
  key: `shift-${shiftKeySeq++}`,
  day_of_week: day,
  start_time: start,
  end_time: end,
  is_active: true,
});

const weekdayShifts = () => [0, 1, 2, 3, 4].map((day) => makeShift(day));

const shiftsFromResource = (resource: Resource): ShiftRow[] => {
  const hours = resource.working_hours ?? [];
  if (hours.length === 0) return [];
  return [...hours]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    .map((wh) => makeShift(wh.day_of_week, wh.start_time, wh.end_time));
};

export default function ResourceCrud({ type }: { type: ResourceType }) {
  const config = RESOURCE_TYPE_META[type];
  const TypeIcon = config.icon;

  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // background refetch: keep rows visible
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [refreshToken, setRefreshToken] = useState(0);

  // Editor modal (shared by create + edit)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY);
  const [isActive, setIsActive] = useState(true);
  const [shifts, setShifts] = useState<ShiftRow[]>(weekdayShifts);

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Ask for a reload; the fetch itself lives in the effect below so that a
  // stale in-flight response can never overwrite a newer one.
  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getResources({
        resource_type: type,
        q: debouncedSearch || undefined,
        is_active: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
      })
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((err: Error) => {
        if (active) setNotice({ tone: 'error', text: `Could not load ${config.plural.toLowerCase()}: ${err.message}` });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [type, debouncedSearch, statusFilter, refreshToken, config.plural]);

  // Auto-dismiss the success/error banner so it never piles up
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((r) => r.is_active).length,
    inactive: items.filter((r) => !r.is_active).length,
  }), [items]);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setCapacity(1);
    setCompanyId(DEFAULT_COMPANY);
    setIsActive(true);
    setShifts(weekdayShifts());
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (resource: Resource) => {
    setEditing(resource);
    setCode(resource.code);
    setName(resource.name);
    setCapacity(resource.capacity);
    setCompanyId(resource.company_id);
    setIsActive(resource.is_active);
    setShifts(shiftsFromResource(resource));
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditing(null);
  };

  const updateShift = (key: string, patch: Partial<WorkingHoursInput>) => {
    setShifts((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const validate = (): string | null => {
    if (!code.trim()) return 'Code is required.';
    if (!name.trim()) return 'Name is required.';
    if (!Number.isFinite(capacity) || capacity < 1) return 'Capacity must be at least 1.';
    for (const shift of shifts) {
      if (shift.end_time <= shift.start_time) {
        return `${DAYS[shift.day_of_week]}: end time must be after start time.`;
      }
    }
    const seen = new Set<string>();
    for (const shift of shifts) {
      const key = `${shift.day_of_week}|${shift.start_time}|${shift.end_time}`;
      if (seen.has(key)) return `${DAYS[shift.day_of_week]}: duplicate shift ${toInputTime(shift.start_time)}-${toInputTime(shift.end_time)}.`;
      seen.add(key);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }

    setSaving(true);
    setFormError(null);
    const payloadShifts: WorkingHoursInput[] = shifts.map(({ day_of_week, start_time, end_time, is_active }) => ({
      day_of_week,
      start_time: toApiTime(start_time),
      end_time: toApiTime(end_time),
      is_active,
    }));

    try {
      if (editing) {
        await api.updateResource(editing.id, {
          code: code.trim(),
          name: name.trim(),
          capacity,
          company_id: companyId.trim() || DEFAULT_COMPANY,
          is_active: isActive,
        });
        // Working hours live in their own table, so they are replaced separately
        await api.replaceWorkingHours(editing.id, payloadShifts);
        setNotice({ tone: 'success', text: `${config.label} "${code.trim()}" updated.` });
      } else {
        await api.createResource({
          code: code.trim(),
          name: name.trim(),
          resource_type: type,
          company_id: companyId.trim() || DEFAULT_COMPANY,
          capacity,
          is_active: isActive,
          working_hours: payloadShifts,
        });
        setNotice({ tone: 'success', text: `${config.label} "${code.trim()}" created.` });
      }
      setEditorOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await api.deleteResource(pendingDelete.id);
      setNotice({ tone: 'success', text: result.message });
      setPendingDelete(null);
      refresh();
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (resource: Resource) => {
    try {
      await api.updateResource(resource.id, { is_active: !resource.is_active });
      setNotice({
        tone: 'success',
        text: `${resource.code} ${resource.is_active ? 'deactivated' : 'activated'}.`,
      });
      refresh();
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TypeIcon className={`w-6 h-6 ${config.accentText}`} />
            <span>{config.plural}</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{config.blurb}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5"
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openCreate}
            className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-md flex items-center gap-1.5 ${config.accentButton}`}
          >
            <Plus className="w-4 h-4" />
            <span>New {config.label}</span>
          </button>
        </div>
      </div>

      {/* Notice banner */}
      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-medium ${
            notice.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
          }`}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats + filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {stats.total} shown
          </span>
          <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {stats.active} active
          </span>
          <span className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            {stats.inactive} inactive
          </span>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row gap-2 lg:justify-end">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setBusy(true); setSearch(e.target.value); }}
              placeholder={`Search ${config.plural.toLowerCase()} by code or name`}
              className="w-full sm:w-72 pl-9 pr-9 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
            />
            {busy && (
              <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin" />
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setBusy(true); setStatusFilter(e.target.value as StatusFilter); }}
            className="px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500">Loading {config.plural.toLowerCase()}...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-center">
            <TypeIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
            <div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                No {config.plural.toLowerCase()} found
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {debouncedSearch || statusFilter !== 'ALL'
                  ? 'Try clearing the search or status filter.'
                  : `Register your first ${config.label.toLowerCase()} to make it schedulable.`}
              </p>
            </div>
            <button
              onClick={openCreate}
              className={`px-4 py-2 rounded-xl text-white text-xs font-semibold ${config.accentButton}`}
            >
              New {config.label}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">{config.companyLabel}</th>
                  <th className="px-4 py-3 font-semibold text-center">{config.capacityLabel}</th>
                  <th className="px-4 py-3 font-semibold">Working hours</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold ${config.accentText}`}>{r.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                        {r.company_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-semibold ${config.accentSoft}`}>{r.capacity}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.working_hours && r.working_hours.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[16rem]">
                          {[...r.working_hours]
                            .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                            .map((wh, idx) => (
                              <span
                                key={wh.id ?? idx}
                                className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                              >
                                {DAYS[wh.day_of_week]} {toInputTime(wh.start_time)}-{toInputTime(wh.end_time)}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">24/7 or unconfigured</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          r.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${r.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleActive(r)}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title={r.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title={`Edit ${config.label.toLowerCase()}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPendingDelete(r)}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title={`Delete ${config.label.toLowerCase()}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 py-10 overflow-y-auto bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-2xl w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <TypeIcon className={`w-4 h-4 ${config.accentText}`} />
                <span>{editing ? `Edit ${config.label}: ${editing.code}` : `Register New ${config.label}`}</span>
              </h3>
              <button onClick={closeEditor} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{config.label} Code (unique) *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={`e.g. ${config.codePlaceholder}`}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{config.companyLabel}</label>
                  <input
                    type="text"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">{config.label} Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${config.namePlaceholder}`}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block font-semibold mb-1">{config.capacityLabel}</label>
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">{config.capacityHint}</p>
                </div>
                <div className="flex items-center gap-2 sm:pt-7">
                  <input
                    type="checkbox"
                    id={`active-${type}`}
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300"
                  />
                  <label htmlFor={`active-${type}`} className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {config.label} is active (schedulable)
                  </label>
                </div>
              </div>

              {/* Working hours editor */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    Weekly Working Hours
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShifts(weekdayShifts())}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Mon-Fri 09:00-18:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setShifts((prev) => [...prev, makeShift(0)])}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add shift
                    </button>
                  </div>
                </div>

                {shifts.length === 0 ? (
                  <p className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 italic">
                    No working hours — the {config.label.toLowerCase()} is treated as available 24/7.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {shifts.map((shift) => (
                      <div key={shift.key} className="flex items-center gap-2">
                        <select
                          value={shift.day_of_week}
                          onChange={(e) => updateShift(shift.key, { day_of_week: Number(e.target.value) })}
                          className="w-24 p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                        >
                          {DAYS.map((d, idx) => (
                            <option key={d} value={idx}>{d}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={toInputTime(shift.start_time)}
                          onChange={(e) => updateShift(shift.key, { start_time: toApiTime(e.target.value) })}
                          className="flex-1 p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                          required
                        />
                        <span className="text-zinc-400">-</span>
                        <input
                          type="time"
                          value={toInputTime(shift.end_time)}
                          onChange={(e) => updateShift(shift.key, { end_time: toApiTime(e.target.value) })}
                          className="flex-1 p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                          required
                        />
                        <label className="flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                          <input
                            type="checkbox"
                            checked={shift.is_active}
                            onChange={(e) => updateShift(shift.key, { is_active: e.target.checked })}
                            className="w-3.5 h-3.5 rounded border-zinc-300"
                          />
                          On
                        </label>
                        <button
                          type="button"
                          onClick={() => setShifts((prev) => prev.filter((s) => s.key !== shift.key))}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                          title="Remove shift"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 rounded-xl text-white font-semibold flex items-center gap-1.5 disabled:opacity-60 ${config.accentButton}`}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? 'Save Changes' : `Create ${config.label}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete {config.label} {pendingDelete.code}?</span>
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <strong>{pendingDelete.name}</strong> will be removed together with its working hours and exceptions.
              If it is already referenced by any schedule or usage record, the engine keeps the history and
              deactivates the {config.label.toLowerCase()} instead.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

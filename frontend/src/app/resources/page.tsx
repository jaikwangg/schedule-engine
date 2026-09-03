'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Resource, ResourceType, ExceptionType } from '@/types';
import { api } from '@/lib/api';
import { RESOURCE_TYPE_LIST, resourceTypeLabel } from '@/lib/resourceTypes';
import { 
  LayoutGrid, 
  Plus, 
  Wrench, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  Loader2,
  AlertCircle,
  Edit3,
  Trash2,
  X
} from 'lucide-react';

const DAYS_MAP = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Resource Modal
  const [isAddResourceOpen, setIsAddResourceOpen] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [resourceType, setResourceType] = useState<ResourceType>('ROOM');
  const [companyId, setCompanyId] = useState<string>('COM-POST-01');

  // Edit Resource Modal
  const [selectedResourceForEdit, setSelectedResourceForEdit] = useState<Resource | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(1);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Add Exception Modal
  const [isAddExceptionOpen, setIsAddExceptionOpen] = useState<boolean>(false);
  const [selectedResourceIdForExc, setSelectedResourceIdForExc] = useState<string>('');
  const [exceptionType, setExceptionType] = useState<ExceptionType>('MAINTENANCE');
  const [excDate, setExcDate] = useState<string>('');
  const [excStartTime, setExcStartTime] = useState<string>('13:00');
  const [excEndTime, setExcEndTime] = useState<string>('16:00');
  const [excReason, setExcReason] = useState<string>('');

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getResources();
      setResources(data);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
    const today = new Date().toISOString().split('T')[0];
    setExcDate(today);
  }, [fetchResources]);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createResource({
        code,
        name,
        resource_type: resourceType,
        company_id: companyId,
        is_active: true,
        // Default working hours Mon-Fri 09:00 - 18:00
        working_hours: [0, 1, 2, 3, 4].map((day) => ({
          day_of_week: day,
          start_time: '09:00:00',
          end_time: '18:00:00',
          is_active: true,
        })),
      });
      setIsAddResourceOpen(false);
      setCode('');
      setName('');
      fetchResources();
    } catch (err: any) {
      alert(`Error creating resource: ${err.message}`);
    }
  };

  const openEditModal = (r: Resource) => {
    setSelectedResourceForEdit(r);
    setEditName(r.name);
    setEditCapacity(r.capacity);
    setEditIsActive(r.is_active);
  };

  const handleUpdateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceForEdit) return;
    try {
      await api.updateResource(selectedResourceForEdit.id, {
        name: editName,
        capacity: editCapacity,
        is_active: editIsActive,
      });
      setSelectedResourceForEdit(null);
      fetchResources();
    } catch (err: any) {
      alert(`Error updating resource: ${err.message}`);
    }
  };

  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addResourceException({
        resource_id: selectedResourceIdForExc || null,
        exception_type: exceptionType,
        start_at: `${excDate}T${excStartTime}:00`,
        end_at: `${excDate}T${excEndTime}:00`,
        reason: excReason,
      });
      setIsAddExceptionOpen(false);
      setExcReason('');
      fetchResources();
    } catch (err: any) {
      alert(`Error adding exception: ${err.message}`);
    }
  };

  const handleDeleteResource = async (r: Resource) => {
    const ok = confirm(
      `Delete ${r.code} — ${r.name}?\n\n` +
      'It is removed together with its working hours and exceptions. ' +
      'If any schedule or usage record still references it, the engine keeps the history and deactivates it instead.'
    );
    if (!ok) return;
    try {
      const result = await api.deleteResource(r.id);
      alert(result.message);
      fetchResources();
    } catch (err: any) {
      alert(`Error deleting resource: ${err.message}`);
    }
  };

  const handleDeleteException = async (excId: string) => {
    if (!confirm('Are you sure you want to delete this exception?')) return;
    try {
      await api.deleteResourceException(excId);
      fetchResources();
    } catch (err: any) {
      alert(`Error deleting exception: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-blue-600" />
            <span>Resource & Availability Master</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            All schedulable categories in one view — rooms, producers and crew, with working hours and blackout windows
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedResourceIdForExc(resources.length > 0 ? resources[0].id : '');
              setIsAddExceptionOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1.5"
          >
            <Wrench className="w-4 h-4" />
            <span>Add Maintenance / Blackout</span>
          </button>
          <button
            onClick={() => setIsAddResourceOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Resource</span>
          </button>
        </div>
      </div>

      {/* Resources Cards */}
      {loading ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-zinc-500">Loading resources...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {r.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {resourceTypeLabel(r.resource_type)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mt-1">
                    {r.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(r)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    title="Edit Resource Details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteResource(r)}
                    className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Delete Resource"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${r.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${r.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Working Hours Summary */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                  Working Hours Template
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {r.working_hours && r.working_hours.length > 0 ? (
                    r.working_hours.map((wh, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-md text-[11px] font-mono bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                      >
                        {DAYS_MAP[wh.day_of_week]}: {wh.start_time.slice(0, 5)}-{wh.end_time.slice(0, 5)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-400 italic">24/7 or unconfigured</span>
                  )}
                </div>
              </div>

              {/* Blackout / Exceptions */}
              {r.exceptions && r.exceptions.length > 0 && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Scheduled Exceptions ({r.exceptions.length})
                  </span>
                  <div className="space-y-1">
                    {r.exceptions.map((exc) => (
                      <div
                        key={exc.id}
                        className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold">[{exc.exception_type}] {exc.reason}</div>
                          <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {new Date(exc.start_at).toLocaleString()} → {new Date(exc.end_at).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteException(exc.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Exception"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Resource Modal */}
      {selectedResourceForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600" />
              <span>Edit Resource: {selectedResourceForEdit.code}</span>
            </h3>

            <form onSubmit={handleUpdateResource} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Resource Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Capacity</label>
                <input
                  type="number"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-600"
                />
                <label htmlFor="isActiveCheck" className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Resource is Active
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedResourceForEdit(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Resource Modal */}
      {isAddResourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-blue-600" />
              <span>Register New Resource</span>
            </h3>

            <form onSubmit={handleCreateResource} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Resource Code (Unique) *</label>
                <input
                  type="text"
                  placeholder="e.g. ROOM-CG2, CGS-003"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Resource Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Color Grading Suite 2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Resource Type</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as ResourceType)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    {RESOURCE_TYPE_LIST.map((meta) => (
                      <option key={meta.type} value={meta.type}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Company / Branch</label>
                  <input
                    type="text"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddResourceOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold"
                >
                  Create Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Exception Modal */}
      {isAddExceptionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              <span>Schedule Maintenance / Blackout</span>
            </h3>

            <form onSubmit={handleAddException} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Resource</label>
                <select
                  value={selectedResourceIdForExc}
                  onChange={(e) => setSelectedResourceIdForExc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="">-- All Resources (Global Holiday) --</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>[{r.code}] {r.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Exception Type</label>
                  <select
                    value={exceptionType}
                    onChange={(e) => setExceptionType(e.target.value as ExceptionType)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="HOLIDAY">Holiday</option>
                    <option value="BREAKDOWN">Breakdown</option>
                    <option value="RESTRICTED">Restricted Access</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={excDate}
                    onChange={(e) => setExcDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={excStartTime}
                    onChange={(e) => setExcStartTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={excEndTime}
                    onChange={(e) => setExcEndTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reason / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Projector calibration & display profiling"
                  value={excReason}
                  onChange={(e) => setExcReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddExceptionOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-semibold"
                >
                  Save Exception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Resource, ConflictCheckResponse, SourceType } from '@/types';
import { api } from '@/lib/api';
import { resourceTypeLabel } from '@/lib/resourceTypes';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Zap, 
  Loader2 
} from 'lucide-react';

interface AllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  resources: Resource[];
  initialResourceId?: string;
}

export default function AllocateModal({
  isOpen,
  onClose,
  onSuccess,
  resources,
  initialResourceId,
}: AllocateModalProps) {
  const [resourceId, setResourceId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('12:00');
  const [sourceType, setSourceType] = useState<SourceType>('PRODUCTION_ORDER');
  const [sourceId, setSourceId] = useState<string>('PO-2026-');
  const [priority, setPriority] = useState<number>(50);
  const [notes, setNotes] = useState<string>('');

  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [conflictResult, setConflictResult] = useState<ConflictCheckResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (initialResourceId) {
      setResourceId(initialResourceId);
    } else if (resources.length > 0 && !resourceId) {
      setResourceId(resources[0].id);
    }
    if (!date) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
    }
  }, [initialResourceId, resources]);

  // Debounced Conflict Check
  useEffect(() => {
    if (!resourceId || !date || !startTime || !endTime) return;

    const start_at = `${date}T${startTime}:00`;
    const end_at = `${date}T${endTime}:00`;

    if (new Date(start_at) >= new Date(end_at)) {
      setConflictResult({
        is_valid: false,
        conflicts: [],
        message: 'End time must be later than start time',
      });
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      setErrorMsg('');
      try {
        const res = await api.checkConflict({
          resource_id: resourceId,
          start_at,
          end_at,
        });
        setConflictResult(res);
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [resourceId, date, startTime, endTime]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !date || !startTime || !endTime || !sourceId) {
      setErrorMsg('Please fill in all required fields');
      return;
    }

    const start_at = `${date}T${startTime}:00`;
    const end_at = `${date}T${endTime}:00`;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.allocateSchedule({
        resource_id: resourceId,
        start_at,
        end_at,
        priority,
        source_type: sourceType,
        source_id: sourceId,
        metadata_json: { notes },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to allocate schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Direct Schedule Allocation</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Allocate resource with real-time conflict protection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Resource Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Resource (เครื่องจักร / ห้อง / บุคลากร) *
            </label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.code}] {r.name} ({resourceTypeLabel(r.resource_type)})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                required
              />
            </div>
          </div>

          {/* Conflict Live Indicator */}
          <div className="rounded-xl border p-3 text-xs transition-colors bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                {isChecking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                ) : conflictResult?.is_valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                Conflict Detection Engine
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Core Domain Rule</span>
            </div>

            {isChecking ? (
              <p className="text-zinc-500">Checking availability against working hours & schedules...</p>
            ) : conflictResult?.is_valid ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                {conflictResult.message} (พร้อมจัดสรรเวลา)
              </p>
            ) : (
              <div className="space-y-1 mt-1">
                <p className="text-rose-600 dark:text-rose-400 font-medium">{conflictResult?.message}</p>
                {conflictResult?.conflicts.map((c, idx) => (
                  <div key={idx} className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="font-semibold text-rose-500">[{c.conflict_type}]</span> {c.title} ({c.description || ''})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source Type & Source ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Demand Source Type *
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              >
                <option value="PRODUCTION_ORDER">Production Order</option>
                <option value="PROJECT_TASK">Project Task</option>
                <option value="BOOKING">Booking</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INTERCOMPANY">Intercompany</option>
                <option value="INTERNAL_WORK">Internal Work</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Source Reference ID *
              </label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="e.g. PO-8891 / PRJ-01"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                required
              />
            </div>
          </div>

          {/* Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Priority (ค่ายิ่งน้อยยิ่งสำคัญ)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Notes / Purpose
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (conflictResult !== null && !conflictResult.is_valid)}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Allocate Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

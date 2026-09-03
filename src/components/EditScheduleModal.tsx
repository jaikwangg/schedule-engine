'use client';

import React, { useState, useEffect } from 'react';
import { TimelineItem, ConflictCheckResponse, ScheduleStatus } from '@/types';
import { api } from '@/lib/api';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Edit3, 
  Loader2,
  Trash2
} from 'lucide-react';

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: TimelineItem | null;
}

export default function EditScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  item,
}: EditScheduleModalProps) {
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [status, setStatus] = useState<ScheduleStatus>('CONFIRMED');
  const [priority, setPriority] = useState<number>(100);
  const [notes, setNotes] = useState<string>('');

  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [conflictResult, setConflictResult] = useState<ConflictCheckResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (item && item.item_type === 'SCHEDULE') {
      const startD = new Date(item.start_at);
      const endD = new Date(item.end_at);

      const dStr = startD.toISOString().split('T')[0];
      const sStr = startD.toTimeString().slice(0, 5);
      const eStr = endD.toTimeString().slice(0, 5);

      setDate(dStr);
      setStartTime(sStr);
      setEndTime(eStr);
      setStatus((item.status as ScheduleStatus) || 'CONFIRMED');
      setPriority(item.priority || 100);
      setNotes(item.metadata?.notes || item.metadata?.product || item.metadata?.project || '');
      setConflictResult({
        is_valid: true,
        conflicts: [],
        message: 'Current time is valid',
      });
    }
  }, [item]);

  // Debounced Conflict Check (excluding current schedule ID)
  useEffect(() => {
    if (!item || !date || !startTime || !endTime) return;

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
          resource_id: item.resource_id,
          start_at,
          end_at,
          exclude_schedule_id: item.id, // Exclude self!
        });
        setConflictResult(res);
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [item, date, startTime, endTime]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      setErrorMsg('Please enter valid date and time');
      return;
    }

    const start_at = `${date}T${startTime}:00`;
    const end_at = `${date}T${endTime}:00`;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.updateSchedule(item.id, {
        start_at,
        end_at,
        status,
        priority,
        metadata_json: {
          ...(item.metadata || {}),
          notes,
        },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this schedule?')) return;
    try {
      await api.cancelSchedule(item.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center font-bold">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Edit Schedule (แก้ไขตาราง)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Resource: [{item.resource_code}] {item.resource_name}
              </p>
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

          {/* Source Info (Read-only) */}
          <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-500 block">Demand Source:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                [{item.source_type}] {item.source_id}
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 block">Current Status:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                {item.status}
              </span>
            </div>
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
                Conflict Detection (ตรวจการชน)
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Self Excluded</span>
            </div>

            {isChecking ? (
              <p className="text-zinc-500">Checking availability against working hours & other schedules...</p>
            ) : conflictResult?.is_valid ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                {conflictResult.message} (ช่วงเวลานี้ว่าง สามารถแก้ไขได้)
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

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Schedule Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ScheduleStatus)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              >
                <option value="CONFIRMED">CONFIRMED (ยืนยัน)</option>
                <option value="PLANNED">PLANNED (วางแผน)</option>
                <option value="TENTATIVE">TENTATIVE (ชั่วคราว)</option>
                <option value="IN_PROGRESS">IN_PROGRESS (กำลังทำ)</option>
                <option value="COMPLETED">COMPLETED (เสร็จสิ้น)</option>
                <option value="CANCELLED">CANCELLED (ยกเลิก)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Priority
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Notes / Metadata
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancel Schedule</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (conflictResult !== null && !conflictResult.is_valid)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes (บันทึก)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

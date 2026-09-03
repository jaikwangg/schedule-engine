'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Resource, TimelineItem } from '@/types';
import { api } from '@/lib/api';
import TimelineGrid from '@/components/TimelineGrid';
import AllocateModal from '@/components/AllocateModal';
import EditScheduleModal from '@/components/EditScheduleModal';
import MiniCalendar from '@/components/MiniCalendar';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  Radio,
  MoveHorizontal,
} from 'lucide-react';

export default function TimelineDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('ALL');
  const [resources, setResources] = useState<Resource[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [monthItems, setMonthItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [liveTime, setLiveTime] = useState<string>('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Modals
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [allocateResourceId, setAllocateResourceId] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<TimelineItem | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    const tick = () => setLiveTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch timeline (day) + month items
  const fetchData = useCallback(async (bg = false) => {
    if (!selectedDate) return;
    if (!bg) setLoading(true);

    const d = new Date(selectedDate);
    const y = d.getFullYear();
    const mo = d.getMonth();
    const first = new Date(y, mo, 1).toISOString().split('T')[0];
    const last  = new Date(y, mo + 1, 0).toISOString().split('T')[0];

    try {
      const [resList, dayItems, mItems] = await Promise.all([
        api.getResources({ resource_type: resourceTypeFilter === 'ALL' ? undefined : resourceTypeFilter }),
        api.getTimeline({ start_at: `${selectedDate}T00:00:00`, end_at: `${selectedDate}T23:59:59`, resource_type: resourceTypeFilter === 'ALL' ? undefined : resourceTypeFilter }),
        api.getTimeline({ start_at: `${first}T00:00:00`, end_at: `${last}T23:59:59`, resource_type: resourceTypeFilter === 'ALL' ? undefined : resourceTypeFilter }),
      ]);
      setResources(resList);
      setTimelineItems(dayItems);
      setMonthItems(mItems);
    } catch (err) {
      console.error(err);
    } finally {
      if (!bg) setLoading(false);
    }
  }, [selectedDate, resourceTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live sync every 5s
  useEffect(() => {
    if (!autoSync) return;
    const iv = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(iv);
  }, [autoSync, fetchData]);

  // Drag-and-drop move handler
  const handleScheduleMove = async (scheduleId: string, newStartAt: string, newEndAt: string, resourceId: string): Promise<boolean> => {
    try {
      const conflictRes = await api.checkConflict({ resource_id: resourceId, start_at: newStartAt, end_at: newEndAt, exclude_schedule_id: scheduleId });
      if (!conflictRes.is_valid) {
        showToast('error', `ย้ายไม่ได้: ${conflictRes.message}`);
        fetchData(true);
        return false;
      }
      await api.updateSchedule(scheduleId, { start_at: newStartAt, end_at: newEndAt });
      const sT = new Date(newStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const eT = new Date(newEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      showToast('success', `✓ เลื่อนเวลาสำเร็จ ${sT} – ${eT}`);
      fetchData(true);
      return true;
    } catch (err: any) {
      showToast('error', `Error: ${err.message}`);
      fetchData(true);
      return false;
    }
  };

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); };
  const goToday = () => setSelectedDate(new Date().toISOString().split('T')[0]);

  const handleCancelSchedule = async (id: string) => {
    if (!confirm('Cancel this schedule?')) return;
    try { await api.cancelSchedule(id); showToast('success', 'ยกเลิกตารางแล้ว'); fetchData(); }
    catch (e: any) { showToast('error', e.message); }
  };

  const handleClockIn = async (resourceId: string, scheduleId: string) => {
    try { await api.clockIn({ resource_id: resourceId, schedule_id: scheduleId, meter_start: 0, operator_id: 'OP-USER-01' }); showToast('success', 'Clock-in สำเร็จ'); fetchData(); }
    catch (e: any) { showToast('error', e.message); }
  };

  const openAllocate = (resourceId = '') => { setAllocateResourceId(resourceId); setIsAllocateOpen(true); };
  const openEdit = (item: TimelineItem) => { setEditItem(item); setIsEditOpen(true); };

  const selectedDateLabel = selectedDate
    ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold border animate-in slide-in-from-bottom-5 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Top header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Schedule Engine Board
            <span className="flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              {liveTime || '––:––:––'}
            </span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <MoveHorizontal className="w-4 h-4 text-blue-500" />
            คลิกและลาก Block เพื่อเลื่อนเวลาได้โดยตรง
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Sync */}
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all ${
              autoSync ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoSync ? 'text-emerald-600 animate-pulse' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">Live: {autoSync ? 'ON' : 'OFF'}</span>
          </button>

          <button onClick={() => fetchData()} className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 shadow-xs">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={() => openAllocate()} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Direct Allocate</span>
          </button>
        </div>
      </div>

      {/* ── Main 2-column Layout ── */}
      <div className="flex gap-4 items-start">

        {/* ─ Left: Mini Calendar (fixed width, sticky) ─ */}
        <div className="w-[220px] shrink-0 sticky top-4">
          <MiniCalendar
            selectedDate={selectedDate}
            monthItems={monthItems}
            onSelectDate={setSelectedDate}
          />

          {/* Resource type filter below mini calendar */}
          <div className="mt-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-2.5 space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1 mb-2">Resource Filter</p>
            {['ALL', 'MACHINE', 'ROOM', 'HUMAN'].map((t) => (
              <button
                key={t}
                onClick={() => setResourceTypeFilter(t)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  resourceTypeFilter === t
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ─ Right: Day Timeline ─ */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Date navigation bar */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center gap-2">
              <button onClick={prevDay} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Today
              </button>
              <button onClick={nextDay} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 ml-1">
                <CalendarIcon className="w-4 h-4 text-zinc-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium"
                />
              </div>
            </div>

            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 hidden md:block truncate">
              {selectedDateLabel}
            </p>
          </div>

          {/* Timeline */}
          {loading ? (
            <div className="p-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-zinc-500">Loading schedule data...</p>
            </div>
          ) : (
            <TimelineGrid
              resources={resources}
              timelineItems={timelineItems}
              currentDate={selectedDate}
              onAllocateClick={openAllocate}
              onEditSchedule={openEdit}
              onCancelSchedule={handleCancelSchedule}
              onClockInClick={handleClockIn}
              onScheduleMove={handleScheduleMove}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AllocateModal
        isOpen={isAllocateOpen}
        onClose={() => setIsAllocateOpen(false)}
        onSuccess={() => fetchData()}
        resources={resources}
        initialResourceId={allocateResourceId}
      />
      <EditScheduleModal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditItem(null); }}
        onSuccess={() => fetchData()}
        item={editItem}
      />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Resource, TimelineItem } from '@/types';
import { api } from '@/lib/api';
import TimelineGrid from '@/components/TimelineGrid';
import AllocateModal from '@/components/AllocateModal';
import EditScheduleModal from '@/components/EditScheduleModal';
import MonthCalendarView from '@/components/MonthCalendarView';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Layers, 
  Cpu, 
  Wrench, 
  RefreshCw, 
  Loader2,
  Radio,
  Clock as ClockIcon,
  CalendarDays,
  MoveHorizontal
} from 'lucide-react';

export default function TimelineDashboardPage() {
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('ALL');
  const [resources, setResources] = useState<Resource[]>([]);
  
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [monthItems, setMonthItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [liveTime, setLiveTime] = useState<string>('');

  // Toast / Status notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Allocate Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false);
  const [selectedResourceIdForModal, setSelectedResourceIdForModal] = useState<string>('');
  const [modalInitialDate, setModalInitialDate] = useState<string>('');

  // Edit Schedule Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<TimelineItem | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);

    // Live clock updater
    const updateClock = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch Day Items & Month Items
  const fetchData = useCallback(async (isBackground = false) => {
    if (!selectedDate) return;
    if (!isBackground) setLoading(true);

    const currD = new Date(selectedDate);
    const year = currD.getFullYear();
    const month = currD.getMonth();
    const firstDayStr = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDayStr = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
      const [resList, dayItems, mItems] = await Promise.all([
        api.getResources({
          resource_type: resourceTypeFilter === 'ALL' ? undefined : resourceTypeFilter,
        }),
        api.getTimeline({
          start_at: `${selectedDate}T00:00:00`,
          end_at: `${selectedDate}T23:59:59`,
          resource_type: resourceTypeFilter === 'ALL' ? undefined : resourceTypeFilter,
        }),
        api.getTimeline({
          start_at: `${firstDayStr}T00:00:00`,
          end_at: `${lastDayStr}T23:59:59`,
          resource_type: resourceTypeFilter === 'ALL' ? undefined : resourceTypeFilter,
        }),
      ]);
      setResources(resList);
      setTimelineItems(dayItems);
      setMonthItems(mItems);
    } catch (err) {
      console.error('Failed to load timeline data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [selectedDate, resourceTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Auto-Sync Polling (every 5 seconds)
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoSync, fetchData]);

  // Drag-and-Drop Schedule Move Handler with Conflict Protection
  const handleScheduleMove = async (
    scheduleId: string,
    newStartAt: string,
    newEndAt: string,
    resourceId: string
  ): Promise<boolean> => {
    try {
      // 1. Pre-flight conflict check (excluding this schedule)
      const conflictRes = await api.checkConflict({
        resource_id: resourceId,
        start_at: newStartAt,
        end_at: newEndAt,
        exclude_schedule_id: scheduleId,
      });

      if (!conflictRes.is_valid) {
        const conflictDesc = conflictRes.conflicts.map((c) => c.title).join(', ');
        showToast('error', `ย้ายไม่สำเร็จ: ${conflictRes.message} (${conflictDesc})`);
        fetchData(true); // Re-fetch to reset visual position
        return false;
      }

      // 2. Perform schedule update
      await api.updateSchedule(scheduleId, {
        start_at: newStartAt,
        end_at: newEndAt,
      });

      const sTime = new Date(newStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const eTime = new Date(newEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      showToast('success', `✓ เลื่อนเวลาสำเร็จเป็น ${sTime} – ${eTime}`);

      fetchData(true);
      return true;
    } catch (err: any) {
      showToast('error', `เกิดข้อผิดพลาดในการเลื่อน: ${err.message}`);
      fetchData(true);
      return false;
    }
  };

  // Navigation handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handlePrevMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleCurrentMonth = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to cancel this schedule?')) return;
    try {
      await api.cancelSchedule(scheduleId);
      showToast('success', 'ยกเลิกตารางเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      showToast('error', `Error: ${err.message}`);
    }
  };

  const handleClockInClick = async (resourceId: string, scheduleId: string) => {
    try {
      await api.clockIn({
        resource_id: resourceId,
        schedule_id: scheduleId,
        meter_start: 0,
        operator_id: 'OP-USER-01',
      });
      showToast('success', 'Clock-in successful! Job is marked IN_PROGRESS.');
      fetchData();
    } catch (err: any) {
      showToast('error', `Clock-in Error: ${err.message}`);
    }
  };

  const openAllocateModal = (resourceId?: string, dateStr?: string) => {
    setSelectedResourceIdForModal(resourceId || '');
    setModalInitialDate(dateStr || selectedDate);
    setIsAllocateModalOpen(true);
  };

  const openEditModal = (item: TimelineItem) => {
    setSelectedItemForEdit(item);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all animate-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Schedule Engine Board</span>
            <span className="flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              {liveTime || 'Real-Time'}
            </span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <MoveHorizontal className="w-4 h-4 text-blue-500 inline" />
            <span>สามารถคลิกและลาก (Drag & Drop) เพื่อเลื่อนช่วงเวลาของงานได้โดยตรง</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <ClockIcon className="w-3.5 h-3.5" />
              <span>Day Timeline</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month Calendar</span>
            </button>
          </div>

          {/* Live Sync Button */}
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
              autoSync
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'
            }`}
            title="Toggle Live Auto-Sync (5s Polling)"
          >
            <Radio className={`w-3.5 h-3.5 ${autoSync ? 'text-emerald-600 animate-pulse' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">Live Sync: {autoSync ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => openAllocateModal()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Direct Allocate</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & Resource Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={viewMode === 'timeline' ? handlePrevDay : handlePrevMonth}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            title={viewMode === 'timeline' ? 'Previous Day' : 'Previous Month'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Today
          </button>
          <button
            onClick={viewMode === 'timeline' ? handleNextDay : handleNextMonth}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            title={viewMode === 'timeline' ? 'Next Day' : 'Next Month'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 ml-2">
            <CalendarIcon className="w-4 h-4 text-zinc-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium"
            />
          </div>
        </div>

        {/* Resource Type Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-medium">
          {['ALL', 'MACHINE', 'ROOM', 'HUMAN'].map((t) => (
            <button
              key={t}
              onClick={() => setResourceTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                resourceTypeFilter === t
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area: Day Timeline vs Month Calendar */}
      {loading ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-zinc-500">Querying schedule & availability engine...</p>
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineGrid
          resources={resources}
          timelineItems={timelineItems}
          currentDate={selectedDate}
          onAllocateClick={openAllocateModal}
          onEditSchedule={openEditModal}
          onCancelSchedule={handleCancelSchedule}
          onClockInClick={handleClockInClick}
          onScheduleMove={handleScheduleMove}
        />
      ) : (
        <MonthCalendarView
          currentDate={selectedDate}
          monthItems={monthItems}
          resources={resources}
          onSelectDate={(dateStr) => setSelectedDate(dateStr)}
          onSwitchToTimeline={(dateStr) => {
            setSelectedDate(dateStr);
            setViewMode('timeline');
          }}
          onEditSchedule={openEditModal}
          onAllocateOnDate={(dateStr) => openAllocateModal(undefined, dateStr)}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onCurrentMonth={handleCurrentMonth}
        />
      )}

      {/* Direct Allocate Modal */}
      <AllocateModal
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        onSuccess={() => fetchData()}
        resources={resources}
        initialResourceId={selectedResourceIdForModal}
      />

      {/* Edit Schedule Modal */}
      <EditScheduleModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedItemForEdit(null);
        }}
        onSuccess={() => fetchData()}
        item={selectedItemForEdit}
      />
    </div>
  );
}

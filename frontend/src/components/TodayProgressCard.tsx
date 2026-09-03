'use client';

import React, { useState, useEffect } from 'react';
import { TimelineItem, Resource } from '@/types';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  PlayCircle, 
  AlertTriangle,
  Layers,
  Activity
} from 'lucide-react';

interface TodayProgressCardProps {
  currentDate: string;
  timelineItems: TimelineItem[];
  resources: Resource[];
}

export default function TodayProgressCard({
  currentDate,
  timelineItems,
  resources,
}: TodayProgressCardProps) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = now.toISOString().split('T')[0];
  const isToday = currentDate === todayStr;

  // 1. Calculate Day Elapsed Progress (Assume Standard Working Shift: 08:00 - 17:00 = 9 Hours)
  const shiftStartHour = 8;
  const shiftEndHour = 17;
  const totalShiftMinutes = (shiftEndHour - shiftStartHour) * 60; // 540 mins

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const shiftStartMinutes = shiftStartHour * 60;
  const shiftEndMinutes = shiftEndHour * 60;

  let workdayProgressPct = 0;
  if (currentTotalMinutes <= shiftStartMinutes) {
    workdayProgressPct = 0;
  } else if (currentTotalMinutes >= shiftEndMinutes) {
    workdayProgressPct = 100;
  } else {
    workdayProgressPct = Math.round(((currentTotalMinutes - shiftStartMinutes) / totalShiftMinutes) * 100);
  }

  // 2. Count Schedule Statuses for Today
  const schedules = timelineItems.filter((i) => i.item_type === 'SCHEDULE');
  const exceptions = timelineItems.filter((i) => i.item_type === 'EXCEPTION');

  const inProgressCount = schedules.filter((s) => s.status === 'IN_PROGRESS').length;
  const completedCount = schedules.filter((s) => s.status === 'COMPLETED').length;
  const confirmedCount = schedules.filter((s) => s.status === 'CONFIRMED' || s.status === 'PLANNED').length;
  const tentativeCount = schedules.filter((s) => s.status === 'TENTATIVE').length;

  // 3. Calculate Overall Resource Utilization Rate (Booked Hours vs Available Hours)
  let totalBookedMinutes = 0;
  schedules.forEach((s) => {
    const start = new Date(s.start_at);
    const end = new Date(s.end_at);
    const diffMins = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    totalBookedMinutes += diffMins;
  });

  const totalResourceCapacityMinutes = Math.max(1, resources.length * totalShiftMinutes);
  const utilizationPct = Math.min(100, Math.round((totalBookedMinutes / totalResourceCapacityMinutes) * 100));

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-white via-zinc-50 to-blue-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-blue-950/20 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Today's Execution Progress (ความคืบหน้าของวันนี้)</span>
              {isToday && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
                  ● TODAY
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shift 08:00 - 17:00 • Resource Utilization & Real-time Task Breakdown
            </p>
          </div>
        </div>

        {/* Workday Clock Indicator */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-mono self-start sm:self-auto shadow-xs">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-zinc-500">Shift Elapsed:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{workdayProgressPct}%</span>
        </div>
      </div>

      {/* Progress Bars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Workday Elapsed Bar */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Workday Time Elapsed (เวลากะทำงานที่ผ่านไป)
            </span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">{workdayProgressPct}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
            <div
              style={{ width: `${workdayProgressPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>08:00 AM (Start)</span>
            <span>12:30 PM (Mid)</span>
            <span>17:00 PM (End)</span>
          </div>
        </div>

        {/* Capacity Utilization Bar */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Resource Utilization Rate (อัตราการถูกจอง/ใช้งาน)
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">{utilizationPct}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
            <div
              style={{ width: `${utilizationPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>Booked: {Math.round((totalBookedMinutes / 60) * 10) / 10} hrs</span>
            <span>Capacity: {resources.length * 9} hrs total</span>
          </div>
        </div>
      </div>

      {/* Task Status Pills Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
          <span className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Confirmed
          </span>
          <span className="font-mono font-bold text-sm text-blue-800 dark:text-blue-200">{confirmedCount}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 flex items-center justify-between">
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5" /> In Progress
          </span>
          <span className="font-mono font-bold text-sm text-amber-800 dark:text-amber-200">{inProgressCount}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
          <span className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-200">{completedCount}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Maintenance
          </span>
          <span className="font-mono font-bold text-sm text-rose-800 dark:text-rose-200">{exceptions.length}</span>
        </div>
      </div>
    </div>
  );
}

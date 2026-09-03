'use client';

import React from 'react';
import { TimelineItem, Resource } from '@/types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Wrench,
  Layers,
  Sparkles
} from 'lucide-react';

interface MonthCalendarViewProps {
  currentDate: string;
  monthItems: TimelineItem[];
  resources: Resource[];
  onSelectDate: (dateStr: string) => void;
  onSwitchToTimeline: (dateStr: string) => void;
  onEditSchedule: (item: TimelineItem) => void;
  onAllocateOnDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}

// Sunday on the left (Sun -> Sat)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthCalendarView({
  currentDate,
  monthItems,
  resources,
  onSelectDate,
  onSwitchToTimeline,
  onEditSchedule,
  onAllocateOnDate,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
}: MonthCalendarViewProps) {
  const currentD = new Date(currentDate);
  const year = currentD.getFullYear();
  const month = currentD.getMonth(); // 0-indexed

  const monthName = currentD.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate calendar days grid starting on Sunday (0 = Sun, 6 = Sat)
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells = [];

  // 1. Previous month padding days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthD = new Date(year, month - 1, dayNum);
    const dateStr = prevMonthD.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
    });
  }

  // 2. Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const currD = new Date(year, month, d);
    const y = currD.getFullYear();
    const m = String(currD.getMonth() + 1).padStart(2, '0');
    const dayFormatted = String(d).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayFormatted}`;

    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // 3. Next month padding days to complete 35 or 42 grid cells
  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonthD = new Date(year, month + 1, d);
    const dateStr = nextMonthD.toISOString().split('T')[0];
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  const getSourceStyle = (sourceType?: string | null, itemType?: string) => {
    if (itemType === 'EXCEPTION') {
      return 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300';
    }
    switch (sourceType) {
      case 'PRODUCTION_ORDER':
        return 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300';
      case 'PROJECT_TASK':
        return 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900/60 text-purple-800 dark:text-purple-300';
      case 'BOOKING':
        return 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300';
      case 'MAINTENANCE':
        return 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300';
      default:
        return 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300';
    }
  };

  const formatEventTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-950/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{monthName}</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {monthItems.length} total events scheduled across {resources.length} resources
            </p>
          </div>
        </div>

        {/* Month Navigator Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={onPrevMonth}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onCurrentMonth}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Today
          </button>
          <button
            onClick={onNextMonth}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Row (Sun on the left) */}
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-center font-semibold text-xs py-2.5 text-zinc-500 dark:text-zinc-400">
        {WEEKDAYS.map((day, idx) => (
          <div key={day} className={idx === 0 || idx === 6 ? 'text-rose-500/80 dark:text-rose-400/80 font-bold' : ''}>
            {day}
          </div>
        ))}
      </div>

      {/* 7-Column Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-zinc-800">
        {calendarCells.map((cell, idx) => {
          const isSelected = cell.dateStr === currentDate;
          const isToday = cell.dateStr === todayStr;

          // Filter events falling on this cell date
          const dayEvents = monthItems.filter((item) => {
            const itemDate = item.start_at.split('T')[0];
            return itemDate === cell.dateStr;
          });

          return (
            <div
              key={idx}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[120px] p-2 transition-all flex flex-col justify-between group cursor-pointer relative ${
                !cell.isCurrentMonth
                  ? 'bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-400 dark:text-zinc-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
              } ${isSelected ? 'ring-2 ring-blue-500 ring-inset z-10' : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'}`}
            >
              {/* Day Number & Quick Action Header */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold transition-all ${
                    isToday
                      ? 'bg-rose-600 text-white shadow-xs animate-pulse'
                      : isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600'
                  }`}
                >
                  {cell.dayNum}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAllocateOnDate(cell.dateStr);
                    }}
                    className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    title="Add schedule on this day"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwitchToTimeline(cell.dateStr);
                    }}
                    className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold px-1 rounded hover:underline"
                    title="Switch to timeline view"
                  >
                    Day →
                  </button>
                </div>
              </div>

              {/* Event Badges List */}
              <div className="space-y-1 my-1.5 flex-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => {
                  const sTime = formatEventTime(event.start_at);
                  const badgeStyle = getSourceStyle(event.source_type, event.item_type);

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.item_type === 'SCHEDULE') {
                          onEditSchedule(event);
                        }
                      }}
                      className={`px-1.5 py-1 rounded-md text-[10px] font-medium border flex items-center justify-between gap-1 shadow-2xs hover:scale-[1.02] transition-transform ${badgeStyle}`}
                      title={`Click to edit: [${event.resource_code}] ${event.title} (${sTime})`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-mono text-[9px] opacity-75 shrink-0">{sTime}</span>
                        <span className="truncate font-semibold">{event.title}</span>
                      </div>
                      <span className="text-[9px] font-mono shrink-0 uppercase opacity-80">
                        {event.resource_code}
                      </span>
                    </div>
                  );
                })}

                {dayEvents.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwitchToTimeline(cell.dateStr);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-blue-600 font-mono pl-1 block text-left"
                  >
                    +{dayEvents.length - 3} more items →
                  </button>
                )}
              </div>

              {/* Day Bottom Indicator */}
              {isToday && (
                <div className="text-[9px] font-bold text-rose-600 dark:text-rose-400 font-mono tracking-wider text-right">
                  TODAY
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

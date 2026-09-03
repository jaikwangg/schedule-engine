'use client';

import React, { useState } from 'react';
import { TimelineItem } from '@/types';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface MiniCalendarProps {
  selectedDate: string;
  monthItems: TimelineItem[];
  onSelectDate: (dateStr: string) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDotColor(sourceType?: string | null, itemType?: string) {
  if (itemType === 'EXCEPTION') return 'bg-amber-400';
  switch (sourceType) {
    case 'PRODUCTION_ORDER': return 'bg-blue-500';
    case 'PROJECT_TASK': return 'bg-purple-500';
    case 'BOOKING': return 'bg-emerald-500';
    case 'MAINTENANCE': return 'bg-rose-500';
    default: return 'bg-zinc-400';
  }
}

export default function MiniCalendar({ selectedDate, monthItems, onSelectDate }: MiniCalendarProps) {
  // The mini calendar tracks its own month independently
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = new Date().toISOString().split('T')[0];

  const monthLabel = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build grid cells
  type Cell = { dateStr: string; dayNum: number; isCurrentMonth: boolean };
  const cells: Cell[] = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    cells.push({ dateStr: d.toISOString().split('T')[0], dayNum: daysInPrevMonth - i, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = new Date(year, month, d);
    const m = String(month + 1).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    cells.push({ dateStr: `${year}-${m}-${day}`, dayNum: d, isCurrentMonth: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const dd = new Date(year, month + 1, d);
    cells.push({ dateStr: dd.toISOString().split('T')[0], dayNum: d, isCurrentMonth: false });
  }

  // Group events by date for dot indicators
  const eventsByDate: Record<string, TimelineItem[]> = {};
  for (const item of monthItems) {
    const dateStr = item.start_at.split('T')[0];
    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
    eventsByDate[dateStr].push(item);
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    onSelectDate(new Date().toISOString().split('T')[0]);
  };

  // Keep mini calendar in sync if selectedDate's month changes from outside
  React.useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (d.getFullYear() !== year || d.getMonth() !== month) {
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-3 w-full select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={goToday}
          className="text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {monthLabel}
        </button>

        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] font-bold py-1 ${i === 0 || i === 6 ? 'text-rose-400/80' : 'text-zinc-400 dark:text-zinc-500'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, idx) => {
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const events = eventsByDate[cell.dateStr] || [];
          const count = events.length;

          // Up to 3 dot colors to display
          const dotColors = [...new Set(events.map((e) => getDotColor(e.source_type, e.item_type)))].slice(0, 3);

          return (
            <div
              key={idx}
              onClick={() => { if (cell.isCurrentMonth) onSelectDate(cell.dateStr); }}
              className={`flex flex-col items-center py-1 rounded-lg transition-all ${
                !cell.isCurrentMonth
                  ? 'opacity-30 cursor-default'
                  : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'
              } ${isSelected ? '!bg-blue-600 !text-white' : ''}`}
            >
              {/* Day number */}
              <span
                className={`text-xs font-mono font-semibold leading-none w-6 h-6 flex items-center justify-center rounded-full ${
                  isSelected
                    ? 'text-white'
                    : isToday
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-bold ring-1 ring-rose-400'
                    : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {cell.dayNum}
              </span>

              {/* Event dots */}
              <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                {count > 0 && dotColors.map((c, i) => (
                  <span key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/80' : c}`} />
                ))}
                {count > 3 && (
                  <span className={`text-[8px] font-bold leading-none ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>+</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: event count for selected date */}
      {selectedDate && (eventsByDate[selectedDate]?.length ?? 0) > 0 && (
        <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium text-center">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{eventsByDate[selectedDate].length}</span>
            {' '}events on selected day
          </p>
        </div>
      )}
    </div>
  );
}

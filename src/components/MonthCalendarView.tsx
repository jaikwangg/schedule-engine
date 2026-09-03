'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TimelineItem, Resource } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  X,
  Clock,
  ArrowRight,
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// How many event pills to show before collapsing to popover
const MAX_VISIBLE = 3;

function getSourceStyle(sourceType?: string | null, itemType?: string) {
  if (itemType === 'EXCEPTION')
    return 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';
  switch (sourceType) {
    case 'PRODUCTION_ORDER':
      return 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300';
    case 'PROJECT_TASK':
      return 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300';
    case 'BOOKING':
      return 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300';
    case 'MAINTENANCE':
      return 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300';
    default:
      return 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300';
  }
}

function getDotColor(sourceType?: string | null, itemType?: string) {
  if (itemType === 'EXCEPTION') return 'bg-amber-500';
  switch (sourceType) {
    case 'PRODUCTION_ORDER': return 'bg-blue-500';
    case 'PROJECT_TASK': return 'bg-purple-500';
    case 'BOOKING': return 'bg-emerald-500';
    case 'MAINTENANCE': return 'bg-rose-500';
    default: return 'bg-zinc-400';
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Day Detail Popover ────────────────────────────────────────────────────
interface DayPopoverProps {
  dateStr: string;
  events: TimelineItem[];
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onEdit: (item: TimelineItem) => void;
  onAllocate: (dateStr: string) => void;
  onSwitchTimeline: (dateStr: string) => void;
}

function DayPopover({ dateStr, events, anchorRef, onClose, onEdit, onAllocate, onSwitchTimeline }: DayPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const label = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  // Position: try to render below the cell; flip if too close to bottom
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!anchorRef.current || !popRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popH = popRef.current.offsetHeight || 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > popH + 8 ? rect.bottom + window.scrollY + 4 : rect.top + window.scrollY - popH - 4;
    let left = rect.left + window.scrollX;
    const maxLeft = window.innerWidth - 340;
    left = Math.min(left, maxLeft);
    left = Math.max(8, left);
    setPos({ top, left });
  }, [anchorRef]);

  return (
    <div
      ref={popRef}
      style={{ top: pos.top, left: pos.left, zIndex: 9999, width: 320 }}
      className="fixed rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
          <p className="text-xs text-zinc-500">{events.length} รายการในวันนี้</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { onAllocate(dateStr); onClose(); }}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            title="Add schedule"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onSwitchTimeline(dateStr); onClose(); }}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1"
            title="Open Day Timeline"
          >
            <span>Day View</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Event List — scrollable */}
      <div className="overflow-y-auto max-h-72 divide-y divide-zinc-100 dark:divide-zinc-800">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => { if (event.item_type === 'SCHEDULE') { onEdit(event); onClose(); } }}
            className={`flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${event.item_type === 'SCHEDULE' ? 'cursor-pointer' : ''}`}
          >
            {/* Colored dot */}
            <div className="mt-1 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${getDotColor(event.source_type, event.item_type)}`} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{event.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(event.start_at)} – {formatTime(event.end_at)}
                </span>
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">{event.resource_code}</span>
              </div>
            </div>

            <span className={`shrink-0 self-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${getSourceStyle(event.source_type, event.item_type)}`}>
              {event.source_type ?? event.item_type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Month Calendar ───────────────────────────────────────────────────
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
  const month = currentD.getMonth();

  const monthName = currentD.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  // Popover state
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const openPopover = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverDate((prev) => (prev === dateStr ? null : dateStr));
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const d = new Date(year, month - 1, dayNum);
    cells.push({ dateStr: d.toISOString().split('T')[0], dayNum, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = new Date(year, month, d);
    const m = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    cells.push({ dateStr: `${dd.getFullYear()}-${m}-${day}`, dayNum: d, isCurrentMonth: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const dd = new Date(year, month + 1, d);
    cells.push({ dateStr: dd.toISOString().split('T')[0], dayNum: d, isCurrentMonth: false });
  }

  const popoverAnchorRef = useRef<HTMLDivElement | null>(null);
  const popoverEvents = popoverDate
    ? monthItems.filter((i) => i.start_at.split('T')[0] === popoverDate).sort((a, b) => a.start_at.localeCompare(b.start_at))
    : [];

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{monthName}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {monthItems.length} total events · {resources.length} resources
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button onClick={onPrevMonth} className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={onCurrentMonth} className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors">
              Today
            </button>
            <button onClick={onNextMonth} className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Row */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-center font-semibold text-xs py-2.5 text-zinc-500 dark:text-zinc-400">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={i === 0 || i === 6 ? 'text-rose-500/80 dark:text-rose-400/80 font-bold' : ''}>{d}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-zinc-800">
          {cells.map((cell, idx) => {
            const isSelected = cell.dateStr === currentDate;
            const isToday = cell.dateStr === todayStr;

            const dayEvents = monthItems
              .filter((item) => item.start_at.split('T')[0] === cell.dateStr)
              .sort((a, b) => a.start_at.localeCompare(b.start_at));

            const visible = dayEvents.slice(0, MAX_VISIBLE);
            const overflow = dayEvents.length - MAX_VISIBLE;

            // Dot summary bar for days with many events
            const dots = dayEvents.map((e) => getDotColor(e.source_type, e.item_type));

            const cellRef = { current: cellRefs.current.get(cell.dateStr) ?? null } as React.RefObject<HTMLDivElement | null>;
            const isPopoverOpen = popoverDate === cell.dateStr;

            return (
              <div
                key={idx}
                ref={(el) => { if (el) cellRefs.current.set(cell.dateStr, el); }}
                onClick={() => onSelectDate(cell.dateStr)}
                className={`min-h-[110px] p-2 transition-all flex flex-col gap-1 group cursor-pointer relative ${
                  !cell.isCurrentMonth
                    ? 'bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-400 dark:text-zinc-600'
                    : 'bg-white dark:bg-zinc-900'
                } ${isSelected && !isPopoverOpen ? 'ring-2 ring-blue-500 ring-inset z-10' : ''} ${
                  isPopoverOpen ? 'ring-2 ring-indigo-500 ring-inset z-10 bg-indigo-50/30 dark:bg-indigo-950/20' : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                }`}
              >
                {/* Top row: day number + actions */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold transition-all ${
                    isToday ? 'bg-rose-600 text-white animate-pulse'
                    : isSelected || isPopoverOpen ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600'
                  }`}>
                    {cell.dayNum}
                  </span>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAllocateOnDate(cell.dateStr); }}
                      className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800"
                      title="Add"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSwitchToTimeline(cell.dateStr); }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold px-1 rounded hover:underline"
                    >
                      Day →
                    </button>
                  </div>
                </div>

                {/* Visible event pills */}
                <div className="space-y-0.5 flex-1 overflow-hidden">
                  {visible.map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.item_type === 'SCHEDULE') onEditSchedule(event);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 hover:opacity-80 transition-opacity truncate ${getSourceStyle(event.source_type, event.item_type)}`}
                      title={`${event.title} · ${formatTime(event.start_at)}`}
                    >
                      <span className="font-mono text-[9px] opacity-70 shrink-0">{formatTime(event.start_at)}</span>
                      <span className="truncate">{event.title}</span>
                    </div>
                  ))}
                </div>

                {/* Overflow: dot row + "+N more" button */}
                {overflow > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Update popover anchor ref
                      const el = cellRefs.current.get(cell.dateStr) ?? null;
                      (popoverAnchorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                      openPopover(cell.dateStr, e);
                    }}
                    className={`w-full text-left text-[10px] font-semibold rounded px-1.5 py-0.5 flex items-center gap-1.5 transition-colors ${
                      isPopoverOpen
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                    }`}
                  >
                    {/* Mini dot row */}
                    <span className="flex items-center gap-0.5">
                      {dots.slice(MAX_VISIBLE).slice(0, 5).map((c, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${c}`} />
                      ))}
                    </span>
                    <span>+{overflow} more</span>
                  </button>
                )}

                {isToday && (
                  <div className="text-[9px] font-bold text-rose-600 dark:text-rose-400 font-mono tracking-wider text-right">TODAY</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Popover */}
      {popoverDate && (
        <DayPopover
          dateStr={popoverDate}
          events={popoverEvents}
          anchorRef={popoverAnchorRef}
          onClose={() => setPopoverDate(null)}
          onEdit={onEditSchedule}
          onAllocate={onAllocateOnDate}
          onSwitchTimeline={onSwitchToTimeline}
        />
      )}
    </>
  );
}

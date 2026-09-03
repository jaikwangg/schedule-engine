'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Resource, TimelineItem } from '@/types';
import { resourceTypeShort } from '@/lib/resourceTypes';
import {
  Clock,
  Play,
  Trash2,
  Edit3,
  GripVertical,
} from 'lucide-react';

interface TimelineGridProps {
  resources: Resource[];
  timelineItems: TimelineItem[];
  currentDate: string;
  onAllocateClick: (resourceId: string) => void;
  onEditSchedule: (item: TimelineItem) => void;
  onCancelSchedule: (scheduleId: string) => void;
  onClockInClick: (resourceId: string, scheduleId: string) => void;
  onScheduleMove?: (scheduleId: string, newStartAt: string, newEndAt: string, resourceId: string) => Promise<boolean>;
}

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const START_HOUR = 7;
const TOTAL_HOURS = 14;

// Stored in a plain ref so mutations don't cause re-renders
interface DragData {
  itemId: string;
  item: TimelineItem;
  initialStartDecimal: number;
  durationHours: number;
  currentStartDecimal: number;
  startX: number;
  containerWidth: number;
  hasMoved: boolean;
}

// This is the React state that triggers renders
interface DragVisual {
  itemId: string;
  currentStartDecimal: number;
  durationHours: number;
}

export default function TimelineGrid({
  resources,
  timelineItems,
  currentDate,
  onAllocateClick,
  onEditSchedule,
  onCancelSchedule,
  onClockInClick,
  onScheduleMove,
}: TimelineGridProps) {
  const [now, setNow] = useState<Date>(new Date());

  // dragVisual is the React state that causes re-renders for block position
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null);

  // dragData holds all raw data without triggering re-renders
  const dragData = useRef<DragData | null>(null);

  // Ref to prevent click-after-drag from opening edit modal
  const justDragged = useRef(false);

  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rafId = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = now.toISOString().split('T')[0];
  const isToday = currentDate === todayStr;
  const nowHourDecimal = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const isWithinViewHours = nowHourDecimal >= START_HOUR && nowHourDecimal <= START_HOUR + TOTAL_HOURS;
  const nowPercent = ((nowHourDecimal - START_HOUR) / TOTAL_HOURS) * 100;

  const decimalToTimeStr = (dec: number) => {
    const totalMins = Math.round(dec * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getSourceColor = (sourceType?: string | null, itemType?: string) => {
    if (itemType === 'EXCEPTION') return 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200';
    switch (sourceType) {
      case 'PRODUCTION_ORDER': return 'bg-blue-500/15 border-blue-500/50 text-blue-900 dark:text-blue-200';
      case 'PROJECT_TASK': return 'bg-purple-500/15 border-purple-500/50 text-purple-900 dark:text-purple-200';
      case 'BOOKING': return 'bg-emerald-500/15 border-emerald-500/50 text-emerald-900 dark:text-emerald-200';
      case 'MAINTENANCE': return 'bg-rose-500/15 border-rose-500/50 text-rose-900 dark:text-rose-200';
      default: return 'bg-zinc-500/15 border-zinc-500/50 text-zinc-900 dark:text-zinc-200';
    }
  };

  const getSourceBadge = (sourceType?: string | null, itemType?: string) => {
    if (itemType === 'EXCEPTION') return 'MAINTENANCE';
    return sourceType || 'SCHEDULE';
  };

  // ─── Mouse Down: begin drag ───────────────────────────────────────────────
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    item: TimelineItem,
    containerEl: HTMLDivElement,
  ) => {
    if (item.item_type !== 'SCHEDULE' || !onScheduleMove) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const start = new Date(item.start_at);
    const end = new Date(item.end_at);
    const startDecimal = start.getHours() + start.getMinutes() / 60;
    const endDecimal = end.getHours() + end.getMinutes() / 60;
    const durationHours = endDecimal - startDecimal;
    const rect = containerEl.getBoundingClientRect();

    dragData.current = {
      itemId: item.id,
      item,
      initialStartDecimal: startDecimal,
      durationHours,
      currentStartDecimal: startDecimal,
      startX: e.clientX,
      containerWidth: rect.width,
      hasMoved: false,
    };

    setDragVisual({
      itemId: item.id,
      currentStartDecimal: startDecimal,
      durationHours,
    });
  }, [onScheduleMove]);

  // ─── Mouse Move / Up on window ─────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragData.current;
      if (!d) return;

      const deltaX = e.clientX - d.startX;
      if (Math.abs(deltaX) > 3) d.hasMoved = true;

      const deltaHours = (deltaX / d.containerWidth) * TOTAL_HOURS;
      let snapped = Math.round((d.initialStartDecimal + deltaHours) * 4) / 4; // snap 15min
      snapped = Math.max(START_HOUR, Math.min(START_HOUR + TOTAL_HOURS - d.durationHours, snapped));
      d.currentStartDecimal = snapped;

      // Use rAF to throttle React state updates (60fps max)
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setDragVisual({
          itemId: d.itemId,
          currentStartDecimal: d.currentStartDecimal,
          durationHours: d.durationHours,
        });
      });
    };

    const onMouseUp = async () => {
      cancelAnimationFrame(rafId.current);
      const d = dragData.current;
      dragData.current = null;
      setDragVisual(null);

      if (!d) return;

      if (d.hasMoved) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 200);
      }

      const moved = Math.abs(d.currentStartDecimal - d.initialStartDecimal) >= 0.05;
      if (d.hasMoved && moved && onScheduleMove) {
        const startMins = Math.round(d.currentStartDecimal * 60);
        const sH = Math.floor(startMins / 60);
        const sM = startMins % 60;
        const endMins = Math.round((d.currentStartDecimal + d.durationHours) * 60);
        const eH = Math.floor(endMins / 60);
        const eM = endMins % 60;

        const newStartAt = `${currentDate}T${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}:00`;
        const newEndAt   = `${currentDate}T${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}:00`;

        await onScheduleMove(d.item.id, newStartAt, newEndAt, d.item.resource_id);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [currentDate, onScheduleMove]);

  // ─── Block position calculation ───────────────────────────────────────────
  const blockStyle = (item: TimelineItem) => {
    let startDec: number, endDec: number;

    if (dragVisual && dragVisual.itemId === item.id) {
      startDec = dragVisual.currentStartDecimal;
      endDec   = dragVisual.currentStartDecimal + dragVisual.durationHours;
    } else {
      const s = new Date(item.start_at);
      const e = new Date(item.end_at);
      startDec = s.getHours() + s.getMinutes() / 60;
      endDec   = e.getHours() + e.getMinutes() / 60;
    }

    const left  = Math.max(0, ((startDec - START_HOUR) / TOTAL_HOURS) * 100);
    const width = Math.max(1.5, ((Math.min(endDec, START_HOUR + TOTAL_HOURS) - Math.max(startDec, START_HOUR)) / TOTAL_HOURS) * 100);
    return { left: `${left}%`, width: `${width}%` };
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden select-none">

      {/* Header row */}
      <div className="grid grid-cols-[240px_1fr] border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs relative">
        <div className="p-3.5 font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span>Resource / Domain</span>
          {isToday && (
            <span className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/50">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              LIVE
            </span>
          )}
        </div>

        <div className="relative overflow-hidden">
          <div className="grid grid-cols-14 divide-x divide-zinc-200 dark:divide-zinc-800 text-center">
            {HOURS.map((h) => (
              <div key={h} className="py-3 text-zinc-500 dark:text-zinc-400 font-medium">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {isToday && isWithinViewHours && (
            <div
              style={{ left: `${nowPercent}%` }}
              className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none z-30"
            >
              <div className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold text-[10px] shadow-md shadow-rose-500/30 animate-pulse whitespace-nowrap">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resource rows */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {resources.map((resource) => {
          const rowItems = timelineItems.filter((i) => i.resource_id === resource.id);

          return (
            <div
              key={resource.id}
              className="grid grid-cols-[240px_1fr] min-h-[90px] hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors group relative"
            >
              {/* Resource label */}
              <div className="p-3.5 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{resource.code}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {resourceTypeShort(resource.resource_type)}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1 line-clamp-1">{resource.name}</h4>
                </div>
                <button
                  onClick={() => onAllocateClick(resource.id)}
                  className="mt-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                >
                  + Allocate Slot
                </button>
              </div>

              {/* Timeline lane */}
              <div
                ref={(el) => { if (el) containerRefs.current.set(resource.id, el); }}
                className="relative min-h-[80px]"
              >
                {/* Hour grid lines */}
                <div className="absolute inset-0 grid grid-cols-14 divide-x divide-zinc-100 dark:divide-zinc-800/60 pointer-events-none" />

                {/* Now line */}
                {isToday && isWithinViewHours && (
                  <div
                    style={{ left: `${nowPercent}%` }}
                    className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-20 pointer-events-none"
                  >
                    <div className="absolute -top-1 -left-[3px] w-2 h-2 rounded-full bg-rose-600 ring-4 ring-rose-500/20" />
                  </div>
                )}

                {/* Schedule blocks */}
                {rowItems.map((item) => {
                  const isDragging = dragVisual?.itemId === item.id;
                  const style = blockStyle(item);
                  const color = getSourceColor(item.source_type, item.item_type);

                  const displayStart = isDragging ? dragVisual!.currentStartDecimal : undefined;
                  const displayEnd   = isDragging ? dragVisual!.currentStartDecimal + dragVisual!.durationHours : undefined;

                  return (
                    <div
                      key={item.id}
                      style={style}
                      onMouseDown={(e) => {
                        const containerEl = containerRefs.current.get(resource.id);
                        if (containerEl) handleMouseDown(e, item, containerEl);
                      }}
                      onClick={() => {
                        if (item.item_type === 'SCHEDULE' && !justDragged.current) {
                          onEditSchedule(item);
                        }
                      }}
                      className={`absolute top-2.5 bottom-2.5 rounded-xl border p-2 flex flex-col justify-between shadow-xs ${color} ${
                        isDragging
                          ? 'z-40 ring-2 ring-blue-500 shadow-xl opacity-95 cursor-grabbing scale-y-105'
                          : 'cursor-grab hover:z-30 hover:shadow-md active:cursor-grabbing'
                      }`}
                    >
                      {/* Live drag tooltip */}
                      {isDragging && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-zinc-900 text-white font-mono text-[11px] font-bold shadow-xl whitespace-nowrap z-50 flex items-center gap-1.5 border border-zinc-700">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>{decimalToTimeStr(displayStart!)} – {decimalToTimeStr(displayEnd!)}</span>
                        </div>
                      )}

                      {/* Top row */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          {item.item_type === 'SCHEDULE' && (
                            <GripVertical className="w-3.5 h-3.5 text-zinc-400/80 shrink-0" />
                          )}
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/40 truncate">
                            {getSourceBadge(item.source_type, item.item_type)}
                          </span>
                        </div>

                        {item.item_type === 'SCHEDULE' && (
                          <div
                            className="flex items-center gap-1 opacity-80 hover:opacity-100"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button onClick={(e) => { e.stopPropagation(); onEditSchedule(item); }}
                              className="p-1 rounded bg-white/80 dark:bg-zinc-800 text-blue-600 hover:bg-blue-50 shadow-xs" title="Edit">
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onClockInClick(resource.id, item.id); }}
                              className="p-1 rounded bg-white/80 dark:bg-zinc-800 text-emerald-600 hover:bg-emerald-50 shadow-xs" title="Clock In">
                              <Play className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onCancelSchedule(item.id); }}
                              className="p-1 rounded bg-white/80 dark:bg-zinc-800 text-rose-600 hover:bg-rose-50 shadow-xs" title="Cancel">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs font-semibold truncate mt-0.5">{item.title}</p>

                      <div className="flex items-center justify-between text-[11px] font-mono mt-0.5">
                        <span>
                          {isDragging
                            ? `${decimalToTimeStr(displayStart!)} - ${decimalToTimeStr(displayEnd!)}`
                            : `${formatTime(item.start_at)} - ${formatTime(item.end_at)}`}
                        </span>
                        <span className="text-[10px] font-semibold px-1 rounded bg-white/50 dark:bg-black/30">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {rowItems.length === 0 && (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic">
                    No schedules allocated for today
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

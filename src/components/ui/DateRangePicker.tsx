'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Zap,
  Target,
  RotateCcw,
} from 'lucide-react';

/* ── Public Types ─────────────────────────────────────────────────── */
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'last7'
  | 'thisMonth'
  | 'lastMonth'
  | 'last30';

export interface DateRangeValue {
  preset: DatePreset | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface Props {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  className?: string;
}

/* ── Helpers ──────────────────────────────────────────────────────── */
const fmt = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const today = () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

/** Human-readable date: "Nov 11, 2026" */
const humanDate = (iso: string): string => {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Compact human date for range display: "Nov 11" */
const humanDateShort = (iso: string): string => {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Count Mon-Fri working days between two YYYY-MM-DD strings (inclusive) */
const countWorkingDays = (startStr: string, endStr: string): number => {
  const start = new Date(startStr + 'T00:00');
  const end = new Date(endStr + 'T00:00');
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

function getPresetDates(preset: DatePreset): { start: string; end: string } {
  const t = today();
  switch (preset) {
    case 'today':
      return { start: fmt(t), end: fmt(t) };
    case 'yesterday': {
      const y = new Date(t); y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case 'thisWeek': {
      const dow = t.getDay();
      const mon = new Date(t); mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
      return { start: fmt(mon), end: fmt(t) };
    }
    case 'lastWeek': {
      const dow = t.getDay();
      const thisMon = new Date(t); thisMon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
      const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
      const lastFri = new Date(lastMon); lastFri.setDate(lastMon.getDate() + 4);
      return { start: fmt(lastMon), end: fmt(lastFri) };
    }
    case 'last7': {
      const start = new Date(t); start.setDate(t.getDate() - 6);
      return { start: fmt(start), end: fmt(t) };
    }
    case 'thisMonth': {
      const start = new Date(t.getFullYear(), t.getMonth(), 1);
      return { start: fmt(start), end: fmt(t) };
    }
    case 'lastMonth': {
      const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const end = new Date(t.getFullYear(), t.getMonth(), 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'last30': {
      const start = new Date(t); start.setDate(t.getDate() - 29);
      return { start: fmt(start), end: fmt(t) };
    }
  }
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'last30', label: 'Last 30 Days' },
];

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const presetLabel = (key: DatePreset | null): string | null => {
  if (!key) return null;
  return PRESETS.find(p => p.key === key)?.label ?? null;
};

/* ── Component ───────────────────────────────────────────────────── */
export default function DateRangePicker({ value, onChange, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value.startDate ? new Date(value.startDate + 'T00:00') : today();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [draft, setDraft] = useState<{ startDate: string; endDate: string; preset: DatePreset | null }>({
    startDate: value.startDate,
    endDate: value.endDate,
    preset: value.preset,
  });

  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 640,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePanelPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelWidth = Math.min(640, vw - 16);
    const panelHeight = 450;

    // Right-align to trigger if possible, otherwise clamp within viewport
    let left = rect.right - panelWidth;
    if (left < 8) left = Math.max(8, Math.min(rect.left, vw - panelWidth - 8));

    let top = rect.bottom + 8;
    if (top + panelHeight > vh - 8 && rect.top - panelHeight - 8 > 8) {
      top = rect.top - panelHeight - 8;
    }

    setPanelPos({ top, left, width: panelWidth });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDraft({ startDate: value.startDate, endDate: value.endDate, preset: value.preset });
    }
  }, [value, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelPos();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft({ startDate: value.startDate, endDate: value.endDate, preset: value.preset });
        setIsOpen(false);
        setSelecting(null);
      }
    };
    window.addEventListener('resize', updatePanelPos);
    window.addEventListener('scroll', updatePanelPos, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('resize', updatePanelPos);
      window.removeEventListener('scroll', updatePanelPos, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, updatePanelPos, value]);

  const handleOpenToggle = () => {
    if (!isOpen) {
      const d = value.startDate ? new Date(value.startDate + 'T00:00') : today();
      setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
      setDraft({ startDate: value.startDate, endDate: value.endDate, preset: value.preset });
      setSelecting('start');
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSelecting(null);
    }
  };

  // Preset: 1-click immediate apply & close for fast workflow
  const handlePreset = useCallback((preset: DatePreset) => {
    const { start, end } = getPresetDates(preset);
    onChange({ preset, startDate: start, endDate: end });
    setIsOpen(false);
    setSelecting(null);
  }, [onChange]);

  const handleDateClick = useCallback((ds: string) => {
    if (selecting === null || selecting === 'start') {
      setDraft({ preset: null, startDate: ds, endDate: ds });
      setSelecting('end');
    } else {
      const start = draft.startDate;
      if (ds < start) {
        setDraft({ preset: null, startDate: ds, endDate: start });
      } else {
        setDraft({ preset: null, startDate: start, endDate: ds });
      }
      setSelecting(null);
    }
  }, [selecting, draft.startDate]);

  const handleApply = useCallback(() => {
    onChange({ preset: draft.preset, startDate: draft.startDate, endDate: draft.endDate });
    setIsOpen(false);
    setSelecting(null);
  }, [onChange, draft]);

  const handleCancel = useCallback(() => {
    setDraft({ startDate: value.startDate, endDate: value.endDate, preset: value.preset });
    setIsOpen(false);
    setSelecting(null);
  }, [value]);

  const handleResetToToday = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const { start, end } = getPresetDates('today');
    onChange({ preset: 'today', startDate: start, endDate: end });
  }, [onChange]);

  const handleGoToToday = useCallback(() => {
    const t = today();
    setViewMonth({ year: t.getFullYear(), month: t.getMonth() });
  }, []);

  const prevMonth = () => {
    setViewMonth(prev => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const nextMonth = () => {
    setViewMonth(prev => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const todayStr = fmt(today());
  const grid = useMemo(() => getMonthGrid(viewMonth.year, viewMonth.month), [viewMonth]);

  const monthLabel = (y: number, m: number) =>
    new Date(y, m).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const nextMonthData = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [viewMonth]);

  const nextGrid = useMemo(() => getMonthGrid(nextMonthData.year, nextMonthData.month), [nextMonthData]);

  const isInRange = (ds: string) => {
    const effectiveEnd = selecting === 'end' && hoverDate ? (hoverDate > draft.startDate ? hoverDate : draft.startDate) : draft.endDate;
    const effectiveStart = selecting === 'end' && hoverDate && hoverDate < draft.startDate ? hoverDate : draft.startDate;
    return ds >= effectiveStart && ds <= effectiveEnd;
  };
  const isRangeStart = (ds: string) => ds === draft.startDate;
  const isRangeEnd = (ds: string) => {
    if (selecting === 'end' && hoverDate) return ds === hoverDate;
    return ds === draft.endDate;
  };

  const workingDays = useMemo(
    () => countWorkingDays(draft.startDate, draft.endDate),
    [draft.startDate, draft.endDate]
  );

  const triggerLabel = useMemo(() => {
    const pLabel = presetLabel(value.preset);
    if (value.startDate === value.endDate) {
      const hd = humanDate(value.startDate);
      return pLabel ? `${pLabel} · ${humanDateShort(value.startDate)}` : hd;
    }
    const rangeText = `${humanDateShort(value.startDate)} – ${humanDateShort(value.endDate)}`;
    return pLabel ? `${pLabel} · ${rangeText}` : rangeText;
  }, [value]);

  const selectionHint = selecting === 'end' ? 'Step 2: Pick end date' : 'Step 1: Pick start date';

  const renderCalendarGrid = (cells: (Date | null)[]) => (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((d, index) => (
          <div key={`${d}-${index}`} className="text-center text-[10px] font-bold text-slate-500 uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="h-8" />;
          const ds = fmt(cell);
          const isToday = ds === todayStr;
          const inRange = isInRange(ds);
          const isStart = isRangeStart(ds);
          const isEnd = isRangeEnd(ds);
          const isFuture = ds > todayStr;
          const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;

          return (
            <button
              key={ds}
              type="button"
              disabled={isFuture}
              onClick={() => handleDateClick(ds)}
              onMouseEnter={() => selecting === 'end' && setHoverDate(ds)}
              onMouseLeave={() => setHoverDate(null)}
              className={`
                h-8 w-full rounded-lg text-xs font-mono font-semibold transition-all relative
                ${isFuture ? 'text-slate-700 cursor-not-allowed opacity-25' : 'cursor-pointer'}
                ${isWeekend && !inRange && !isFuture ? 'text-rose-400/60' : ''}
                ${isStart || isEnd
                  ? 'bg-indigo-600 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.45)]'
                  : inRange
                    ? 'bg-indigo-500/15 text-indigo-200'
                    : isToday
                      ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                }
              `}
            >
              <span>{cell.getDate()}</span>
              {isToday && !isStart && !isEnd && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const portalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="datepicker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 z-[9995] bg-black/55 backdrop-blur-sm cursor-default"
          />
          <motion.div
            ref={panelRef}
            key="datepicker-panel"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            style={{
              position: 'fixed',
              zIndex: 9996,
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: 'calc(100vh - 16px)',
            }}
            className="rounded-2xl bg-[#0d0f1a] border border-white/[0.12] shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-y-auto"
          >
            <div className="flex flex-col md:flex-row">
              {/* Sidebar: Quick Presets */}
              <div className="md:w-[175px] border-b md:border-b-0 md:border-r border-white/[0.08] p-3.5 bg-[#0a0c15] flex flex-col justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.18em] px-2.5 pb-2">Quick Ranges</p>
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-1">
                    {PRESETS.map(p => {
                      const active = value.preset === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handlePreset(p.key)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            active
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/35'
                              : 'text-slate-400 hover:bg-white/[0.06] hover:text-white border border-transparent'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selection Guidance */}
                <div className={`px-3 py-2.5 rounded-xl border ${
                  selecting === 'end'
                    ? 'bg-emerald-500/10 border-emerald-500/25'
                    : 'bg-indigo-500/10 border-indigo-500/25'
                }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Target size={11} className={selecting === 'end' ? 'text-emerald-400' : 'text-indigo-400'} />
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${
                      selecting === 'end' ? 'text-emerald-300' : 'text-indigo-300'
                    }`}>
                      {selectionHint}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {selecting === 'end'
                      ? `Start: ${humanDateShort(draft.startDate)}`
                      : 'Click any date'}
                  </p>
                </div>
              </div>

              {/* Main Matrix: Dual-Month Calendar */}
              <div className="flex-1 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="flex items-center gap-4 sm:gap-10">
                    <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">{monthLabel(viewMonth.year, viewMonth.month)}</span>
                    <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider hidden md:block">{monthLabel(nextMonthData.year, nextMonthData.month)}</span>
                    <button
                      type="button"
                      onClick={handleGoToToday}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-indigo-500/15 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      title="Jump to current month"
                    >
                      <RotateCcw size={10} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Today</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderCalendarGrid(grid)}
                  <div className="hidden md:block">
                    {renderCalendarGrid(nextGrid)}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-5 pt-4 border-t border-white/[0.08] gap-3">
                  <div className="flex items-center flex-wrap gap-2.5">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-indigo-400" />
                      <span className="text-xs font-bold font-mono text-white tabular-nums">
                        {humanDateShort(draft.startDate)} → {humanDateShort(draft.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25">
                      <Zap size={10} className="text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-300">
                        {workingDays} working day{workingDays !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-[0_4px_16px_rgba(99,102,241,0.35)] cursor-pointer"
                    >
                      Apply Range
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative ${className}`}>
      {/* ── Trigger (matches 38px height of all controls) ──────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpenToggle}
        className={`flex items-center justify-between w-full h-[38px] px-3 gap-2 rounded-xl text-xs transition-all cursor-pointer outline-none border ${
          isOpen
            ? 'border-indigo-500/60 bg-[#141728] shadow-[0_0_0_2px_rgba(99,102,241,0.18)]'
            : 'border-white/[0.09] bg-[#131624] hover:border-white/20 hover:bg-[#171a2b]'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar size={14} className="text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-zinc-100 font-mono truncate text-left">
            {triggerLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value.preset !== 'today' && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleResetToToday}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleResetToToday(e); } }}
              className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Reset to Today"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
        </div>
      </button>

      {mounted && createPortal(portalContent, document.body)}
    </div>
  );
}

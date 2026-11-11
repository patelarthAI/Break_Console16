'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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

/** Compact human date for range display: "Nov 11" (no year) */
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

/** Look up preset label by key */
const presetLabel = (key: DatePreset | null): string | null => {
  if (!key) return null;
  return PRESETS.find(p => p.key === key)?.label ?? null;
};

/* ── Component ───────────────────────────────────────────────────── */
export default function DateRangePicker({ value, onChange, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value.startDate ? new Date(value.startDate + 'T00:00') : today();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Draft state — what the user is building before hitting Apply
  const [draft, setDraft] = useState<{ startDate: string; endDate: string; preset: DatePreset | null }>({
    startDate: value.startDate,
    endDate: value.endDate,
    preset: value.preset,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync draft with external value changes when panel is closed
  useEffect(() => {
    if (!isOpen) {
      setDraft({ startDate: value.startDate, endDate: value.endDate, preset: value.preset });
    }
  }, [value, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelecting(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreset = useCallback((preset: DatePreset) => {
    const { start, end } = getPresetDates(preset);
    setDraft({ preset, startDate: start, endDate: end });
    setSelecting(null);
  }, []);

  const handleDateClick = useCallback((dateStr: string) => {
    if (selecting === null || selecting === 'start') {
      // Set start date; end defaults to same date until they pick the end
      setDraft({ preset: null, startDate: dateStr, endDate: dateStr });
      setSelecting('end');
    } else {
      // End date selection
      const start = draft.startDate;
      if (dateStr < start) {
        setDraft({ preset: null, startDate: dateStr, endDate: start });
      } else {
        setDraft({ preset: null, startDate: start, endDate: dateStr });
      }
      setSelecting(null);
      // Panel stays open — user must click Apply
    }
  }, [selecting, draft.startDate]);

  const handleApply = useCallback(() => {
    onChange({ preset: draft.preset, startDate: draft.startDate, endDate: draft.endDate });
    setIsOpen(false);
    setSelecting(null);
  }, [onChange, draft]);

  const handleCancel = useCallback(() => {
    // Revert draft to the committed value
    setDraft({ startDate: value.startDate, endDate: value.endDate, preset: value.preset });
    setIsOpen(false);
    setSelecting(null);
  }, [value]);

  const handleResetToToday = useCallback((e: React.MouseEvent) => {
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
    new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const nextMonthData = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [viewMonth]);

  const nextGrid = useMemo(() => getMonthGrid(nextMonthData.year, nextMonthData.month), [nextMonthData]);

  const isInRange = (dateStr: string) => {
    const effectiveEnd = selecting === 'end' && hoverDate ? (hoverDate > draft.startDate ? hoverDate : draft.startDate) : draft.endDate;
    const effectiveStart = selecting === 'end' && hoverDate && hoverDate < draft.startDate ? hoverDate : draft.startDate;
    return dateStr >= effectiveStart && dateStr <= effectiveEnd;
  };
  const isRangeStart = (ds: string) => ds === draft.startDate;
  const isRangeEnd = (ds: string) => {
    if (selecting === 'end' && hoverDate) return ds === hoverDate;
    return ds === draft.endDate;
  };

  // Working days for the draft range
  const workingDays = useMemo(
    () => countWorkingDays(draft.startDate, draft.endDate),
    [draft.startDate, draft.endDate]
  );

  // Build human-readable trigger label
  const triggerLabel = useMemo(() => {
    const pLabel = presetLabel(value.preset);
    if (value.startDate === value.endDate) {
      // Single day
      const hd = humanDate(value.startDate);
      return pLabel ? `${pLabel} · ${hd}` : hd;
    }
    const range = `${humanDateShort(value.startDate)} – ${humanDateShort(value.endDate)}`;
    return pLabel ? `${pLabel} · ${range}` : range;
  }, [value]);

  // Selection guidance text
  const selectionHint = useMemo(() => {
    if (selecting === 'start' || selecting === null) return 'Pick start date';
    return 'Pick end date';
  }, [selecting]);

  const renderCalendarGrid = (cells: (Date | null)[], year: number, month: number) => (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {WEEKDAYS.map((d, index) => (
          <div key={`${d}-${index}`} className="text-center text-[9px] font-black text-slate-600 uppercase tracking-widest py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="h-9" />;
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
                h-9 w-full rounded-xl text-[12px] font-mono font-bold transition-all relative overflow-hidden group/cell
                ${isFuture ? 'text-slate-800 cursor-not-allowed opacity-20' : 'cursor-pointer'}
                ${isWeekend && !inRange && !isFuture ? 'text-rose-400/50' : ''}
                ${isStart || isEnd
                  ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-extrabold z-10 border border-violet-400/40 shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                  : inRange
                    ? 'bg-indigo-500/10 text-indigo-300 rounded-none first:rounded-l-xl last:rounded-r-xl border-y border-indigo-500/15'
                    : isToday
                      ? 'bg-indigo-500/10 text-indigo-300 font-extrabold border border-indigo-500/35'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <span className="relative z-10">{cell.getDate()}</span>
              {isToday && !isStart && !isEnd && (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* ── Trigger ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setSelecting('start'); }}
        className={`group flex items-center justify-between w-full px-4 h-11 rounded-xl bg-[#08080b]/40 backdrop-blur-3xl border transition-all duration-300 ${
          isOpen
            ? 'border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
            : 'border-white/[0.06] hover:border-white/20'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Calendar size={15} />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Date Range</span>
            <span className="text-[12px] font-black text-white font-mono leading-none tracking-tight truncate max-w-full">
              {triggerLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Reset-to-today clear button */}
          {value.preset !== 'today' && (
            <div
              role="button"
              tabIndex={0}
              onClick={handleResetToToday}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleResetToToday(e as unknown as React.MouseEvent); }}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors cursor-pointer"
              title="Reset to Today"
            >
              <X size={12} />
            </div>
          )}
          <ChevronDown size={14} className={`text-slate-500 transition-transform duration-500 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
        </div>
      </button>

      {/* ── Dropdown Hub ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="datepicker-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm cursor-default"
            />
            <motion.div
              key="datepicker-panel"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="absolute z-[501] right-0 mt-3 rounded-2xl bg-gradient-to-b from-indigo-500/[0.02] to-[#08080b]/95 backdrop-blur-[48px] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.85)] overflow-hidden w-[640px] max-w-[95vw] max-sm:w-full max-sm:left-0 max-sm:right-0"
            >
              <div className="flex flex-col md:flex-row h-auto">
                {/* Sidebar: Presets */}
                <div className="md:w-[200px] border-b md:border-b-0 md:border-r border-white/5 p-5 space-y-1 bg-white/[0.01]">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-3 pb-4">Quick Ranges</p>
                  {PRESETS.map(p => {
                    const active = draft.preset === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handlePreset(p.key)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 shadow-[0_0_12px_rgba(99,102,241,0.1)]'
                            : 'text-slate-500 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}

                  {/* Selection guidance */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 px-4 py-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {selecting === 'end' ? (
                        <Target size={12} className="text-emerald-400" />
                      ) : (
                        <Target size={12} className="text-indigo-400" />
                      )}
                      <p className={`text-[9px] font-black uppercase tracking-widest ${
                        selecting === 'end' ? 'text-emerald-400' : 'text-indigo-400'
                      }`}>
                        {selectionHint}
                      </p>
                    </div>
                    <p className="text-[9px] text-indigo-400/60 font-bold uppercase tracking-widest leading-normal">
                      {selecting === 'end'
                        ? `Start: ${humanDateShort(draft.startDate)}`
                        : 'Click a date on the calendar'}
                    </p>
                  </motion.div>
                </div>

                {/* Main Matrix: Calendars */}
                <div className="flex-1 p-6">
                  <div className="flex items-center justify-between mb-8 px-2">
                    <button type="button" onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all cursor-pointer">
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-6 sm:gap-12">
                      <span className="text-[10px] font-black text-slate-200 uppercase tracking-[0.2em]">{monthLabel(viewMonth.year, viewMonth.month)}</span>
                      <span className="text-[10px] font-black text-slate-200 uppercase tracking-[0.2em] hidden md:block">{monthLabel(nextMonthData.year, nextMonthData.month)}</span>
                      {/* Go to Today button */}
                      <button
                        type="button"
                        onClick={handleGoToToday}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-slate-500 hover:text-indigo-400 transition-all cursor-pointer"
                        title="Go to today"
                      >
                        <RotateCcw size={10} />
                        <span className="text-[8px] font-black uppercase tracking-widest">Today</span>
                      </button>
                    </div>
                    <button type="button" onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all cursor-pointer">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {renderCalendarGrid(grid, viewMonth.year, viewMonth.month)}
                    <div className="hidden md:block">
                      {renderCalendarGrid(nextGrid, nextMonthData.year, nextMonthData.month)}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-10 pt-6 border-t border-white/[0.05] gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <Clock size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Selected</span>
                          <span className="text-[12px] font-black font-mono text-white tabular-nums tracking-tighter">
                            {humanDateShort(draft.startDate)} <span className="mx-1.5 opacity-20 text-xs">→</span> {humanDateShort(draft.endDate)}
                          </span>
                        </div>
                      </div>
                      {/* Working days counter */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Zap size={10} className="text-emerald-400" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                          {workingDays} working day{workingDays !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleCancel}
                        className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleApply}
                        className="px-8 py-3 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-[0_10px_30px_rgba(99,102,241,0.3)] cursor-pointer"
                      >
                        Apply Range
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

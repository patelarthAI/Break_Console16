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

const PRESETS: { key: DatePreset; label: string; icon?: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'last30', label: 'Last 30 Days' },
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

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

/* ── Component ───────────────────────────────────────────────────── */
export default function DateRangePicker({ value, onChange, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value.startDate ? new Date(value.startDate + 'T00:00') : today();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const containerRef = useRef<HTMLDivElement>(null);

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
    onChange({ preset, startDate: start, endDate: end });
    setIsOpen(false);
    setSelecting(null);
  }, [onChange]);

  const handleDateClick = useCallback((dateStr: string) => {
    if (selecting === null || selecting === 'start') {
      onChange({ preset: null, startDate: dateStr, endDate: dateStr });
      setSelecting('end');
    } else {
      // selecting === 'end'
      const start = value.startDate;
      if (dateStr < start) {
        onChange({ preset: null, startDate: dateStr, endDate: start });
      } else {
        onChange({ preset: null, startDate: start, endDate: dateStr });
      }
      setSelecting(null);
      setIsOpen(false);
    }
  }, [selecting, value.startDate, onChange]);

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
  const nextGrid = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month + 1, 1);
    return getMonthGrid(d.getFullYear(), d.getMonth());
  }, [viewMonth]);

  const monthLabel = (y: number, m: number) =>
    new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const nextMonthData = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [viewMonth]);

  /* ── Is date in range? ─────────────────────────────────────────── */
  const isInRange = (dateStr: string) => {
    const effectiveEnd = selecting === 'end' && hoverDate ? (hoverDate > value.startDate ? hoverDate : value.startDate) : value.endDate;
    const effectiveStart = selecting === 'end' && hoverDate && hoverDate < value.startDate ? hoverDate : value.startDate;
    return dateStr >= effectiveStart && dateStr <= effectiveEnd;
  };
  const isRangeStart = (ds: string) => ds === value.startDate;
  const isRangeEnd = (ds: string) => {
    if (selecting === 'end' && hoverDate) return ds === hoverDate;
    return ds === value.endDate;
  };

  /* ── Display label for trigger ─────────────────────────────────── */
  const triggerLabel = (() => {
    if (value.preset) {
      return PRESETS.find(p => p.key === value.preset)?.label ?? 'Select dates';
    }
    if (value.startDate === value.endDate) {
      const d = new Date(value.startDate + 'T00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const s = new Date(value.startDate + 'T00:00');
    const e = new Date(value.endDate + 'T00:00');
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  const renderCalendarGrid = (cells: (Date | null)[], year: number, month: number) => (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-600 uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
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
                h-9 w-full rounded-xl text-[12px] font-bold transition-all relative
                ${isFuture ? 'text-slate-700 cursor-not-allowed opacity-50' : 'cursor-pointer'}
                ${isWeekend && !inRange ? 'text-slate-500 bg-white/[0.01]' : ''}
                ${isStart || isEnd
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black shadow-[0_0_20px_rgba(99,102,241,0.6)] border border-indigo-400/50 z-10 scale-105'
                  : inRange
                    ? 'bg-indigo-500/20 text-indigo-200 border-y border-indigo-500/10 rounded-none first:rounded-l-xl last:rounded-r-xl'
                    : isToday
                      ? 'bg-white/5 text-white ring-1 ring-indigo-400/40'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white hover:border hover:border-white/10'
                }
              `}
            >
              {cell.getDate()}
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
        className={`group flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/[0.03] border transition-all duration-300 backdrop-blur-xl min-h-[44px] ${
          isOpen
            ? 'border-indigo-500/50 bg-white/[0.06] ring-4 ring-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
        }`}
      >
        <div className="flex-1 min-w-0 text-left flex items-center gap-3">
          <Calendar size={16} className={`flex-shrink-0 ${isOpen ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span className="text-[13px] font-semibold text-white truncate">{triggerLabel}</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 ml-auto flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
        />
      </button>

      {/* ── Dropdown ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 24, stiffness: 350 }}
            className="absolute z-[100] right-0 mt-2 rounded-[24px] bg-[#0a001a]/95 border border-white/10 backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden w-[600px] max-w-[95vw]"
            style={{ minHeight: '400px' }}
          >
            <div className="flex flex-col md:flex-row h-[500px] md:h-auto overflow-y-auto custom-scrollbar md:overflow-visible">
              {/* Left: Presets */}
              <div className="md:w-[180px] border-b md:border-b-0 md:border-r border-white/5 p-3 space-y-0.5 flex-shrink-0 grid grid-cols-2 md:grid-cols-1 gap-1 md:gap-0">
                <p className="col-span-2 md:col-span-1 text-[9px] font-bold text-slate-600 uppercase tracking-widest px-3 pt-1 pb-2">Quick Select</p>
                {PRESETS.map(p => {
                  const active = value.preset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handlePreset(p.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                        active
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}

                {/* Status indicator */}
                {selecting === 'end' && (
                  <div className="col-span-2 md:col-span-1 mt-3 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] animate-pulse">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Select end date</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Click to complete range</p>
                  </div>
                )}
              </div>

              {/* Right: Dual calendars */}
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-4 px-1">
                  <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex gap-12">
                    <span className="text-[13px] font-bold text-white">{monthLabel(viewMonth.year, viewMonth.month)}</span>
                    <span className="text-[13px] font-bold text-white">{monthLabel(nextMonthData.year, nextMonthData.month)}</span>
                  </div>
                  <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderCalendarGrid(grid, viewMonth.year, viewMonth.month)}
                  {renderCalendarGrid(nextGrid, nextMonthData.year, nextMonthData.month)}
                </div>

                {/* Footer with selected range */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="font-semibold">{value.startDate || '—'}</span>
                    </div>
                    <span className="text-slate-600">→</span>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="font-semibold">{value.endDate || '—'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); setSelecting(null); }}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-all uppercase tracking-wider"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

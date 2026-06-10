'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, UserCheck, Calendar as CalendarIcon } from 'lucide-react';
import type { LeaveRecord } from '@/types';

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function shiftMonth(date: Date, amount: number) {
  return startOfMonth(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}
function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function prettyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
}
function buildCalendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date: d, key: formatDateKey(d) };
  });
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

const HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface LeaveCalendarProps {
  leaves: LeaveRecord[];
  todayLeaveCount: number;
}

export default function LeaveCalendar({ leaves, todayLeaveCount }: LeaveCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const todayKey = formatDateKey(new Date());

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveRecord[]>();
    for (const l of leaves) {
      const arr = map.get(l.date) ?? [];
      arr.push(l);
      map.set(l.date, arr);
    }
    return map;
  }, [leaves]);

  const cells = buildCalendarCells(month);
  const selectedLeaves = selectedKey ? leavesByDate.get(selectedKey) ?? [] : [];

  const handleDayClick = (key: string, inMonth: boolean) => {
    if (!inMonth) return;
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="relative flex flex-col p-5 rounded-[24px] bg-gradient-to-b from-indigo-500/[0.03] to-transparent border border-white/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/20">
      
      {/* Glow effect in the background */}
      <div className="absolute top-0 right-10 w-24 h-24 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-400">
            <CalendarIcon size={14} />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Leave Desk</div>
            <div className="text-[9px] font-bold text-slate-500 mt-0.5">
              {todayLeaveCount === 0 ? 'All reps present today' : `${todayLeaveCount} on leave today`}
            </div>
          </div>
        </div>
        <span className={`badge ${
          todayLeaveCount === 0 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] animate-pulse'
        } text-[9px] px-2 py-0.5`}>
          {todayLeaveCount === 0 ? 'Clear' : `${todayLeaveCount} Out`}
        </span>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <motion.button 
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.04)' }} 
          whileTap={{ scale: 0.95 }}
          type="button" 
          onClick={() => { setMonth(shiftMonth(month, -1)); setSelectedKey(null); }} 
          className="p-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] text-slate-500 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
        </motion.button>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-200">{formatMonthLabel(month)}</span>
        <motion.button 
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.04)' }} 
          whileTap={{ scale: 0.95 }}
          type="button" 
          onClick={() => { setMonth(shiftMonth(month, 1)); setSelectedKey(null); }} 
          className="p-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] text-slate-500 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronRight size={14} />
        </motion.button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1.5 text-center relative z-10">
        {HEADERS.map((h, i) => (
          <div key={i} className="text-center text-[8px] font-black text-slate-600 py-1 tracking-wider">{h}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5 relative z-10">
        {cells.map((cell) => {
          const inMonth = cell.date.getMonth() === month.getMonth();
          const isToday = cell.key === todayKey;
          const dayLeaves = leavesByDate.get(cell.key) ?? [];
          const hasLeave = dayLeaves.length > 0;
          const isSelected = selectedKey === cell.key;
          const hasUnplanned = dayLeaves.some((l) => !l.is_planned);

          return (
            <motion.button
              type="button"
              key={cell.key}
              onClick={() => handleDayClick(cell.key, inMonth)}
              disabled={!inMonth}
              whileHover={inMonth ? { scale: 1.1, zIndex: 20 } : {}}
              whileTap={inMonth ? { scale: 0.95 } : {}}
              className={`relative flex flex-col items-center justify-center h-[34px] rounded-xl text-[11px] font-mono transition-all duration-300 border ${
                !inMonth
                  ? 'text-slate-800 border-transparent bg-transparent pointer-events-none opacity-20'
                  : isSelected
                  ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-extrabold border-violet-400/50 shadow-[0_0_16px_rgba(139,92,246,0.5)]'
                  : isToday
                  ? 'bg-indigo-500/10 text-indigo-300 font-extrabold border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                  : hasLeave
                  ? 'bg-white/[0.02] border-white/[0.04] text-slate-200 hover:bg-white/[0.06] hover:border-white/[0.08]'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-white border-transparent'
              }`}
            >
              <span>{cell.date.getDate()}</span>
              {hasLeave && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${
                  hasUnplanned 
                    ? 'bg-rose-400 shadow-[0_0_6px_#f43f5e]' 
                    : isSelected 
                    ? 'bg-white shadow-[0_0_6px_#ffffff]' 
                    : 'bg-sky-400 shadow-[0_0_6px_#38bdf8]'
                }`} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Drill-down: who's on leave on the selected day */}
      <AnimatePresence mode="wait">
        {selectedKey && (
          <motion.div
            key={selectedKey}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/[0.06] relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-indigo-400">{prettyDate(selectedKey)}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02] border border-white/[0.05] px-2 py-0.5 rounded-md">
                  {selectedLeaves.length} {selectedLeaves.length === 1 ? 'Leave' : 'Leaves'}
                </span>
              </div>

              {selectedLeaves.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-5 rounded-2xl bg-white/[0.01] border border-dashed border-white/[0.04]">
                  <UserCheck size={14} className="text-emerald-400/40" />
                  <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-600">No one on leave</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedLeaves.map((l, i) => {
                    const isUrgent = !l.is_planned;
                    const dotColor = isUrgent ? '#FF2D55' : '#38bdf8';
                    return (
                      <motion.div
                        key={l.id ?? `${l.employee_name}-${i}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 relative group"
                      >
                        <div 
                          className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-full" 
                          style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                        />
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                          style={{ 
                            background: `linear-gradient(135deg, ${dotColor}33, ${dotColor}08)`, 
                            border: `1px solid ${dotColor}33` 
                          }}
                        >
                          {initials(l.employee_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-extrabold text-white truncate leading-tight group-hover:text-indigo-300 transition-colors">{l.employee_name}</div>
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate mt-0.5">{l.client_name}</div>
                        </div>
                        <span
                          className="text-[7px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-md flex-shrink-0 border"
                          style={{ 
                            color: dotColor, 
                            background: `${dotColor}12`, 
                            borderColor: `${dotColor}22` 
                          }}
                        >
                          {l.leave_type}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

function buildCalendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date: d, key: formatDateKey(d) };
  });
}

const HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface LeaveCalendarProps {
  leaves: LeaveRecord[];
  todayLeaveCount: number;
}

export default function LeaveCalendar({ leaves, todayLeaveCount }: LeaveCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const todayKey = formatDateKey(new Date());
  const leaveDates = new Set(leaves.map((l) => l.date));
  const cells = buildCalendarCells(month);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-bold text-white">Leave Calendar</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {todayLeaveCount === 0 ? '✓ All clear today' : `${todayLeaveCount} on leave today`}
          </div>
        </div>
        <div className={`badge ${todayLeaveCount === 0 ? 'badge-working' : 'badge-leave'} text-[9px]`}>
          {todayLeaveCount === 0 ? 'Clear' : todayLeaveCount}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="p-1 rounded-md hover:bg-white/5 text-slate-500 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-slate-300">{formatMonthLabel(month)}</span>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="p-1 rounded-md hover:bg-white/5 text-slate-500 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {HEADERS.map((h, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-slate-600 py-1">
            {h}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const inMonth = cell.date.getMonth() === month.getMonth();
          const isToday = cell.key === todayKey;
          const hasLeave = leaveDates.has(cell.key);

          return (
            <div
              key={cell.key}
              className={`relative flex items-center justify-center h-7 rounded-md text-[11px] font-medium transition-colors ${
                !inMonth
                  ? 'text-slate-700'
                  : isToday
                  ? 'bg-indigo-600/30 text-white font-bold border border-indigo-500/40'
                  : 'text-slate-400 hover:bg-white/4'
              }`}
            >
              {cell.date.getDate()}
              {hasLeave && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-violet-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

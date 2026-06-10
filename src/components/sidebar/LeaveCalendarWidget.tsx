'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import { getLeaves } from '@/lib/store';
import type { LeaveRecord } from '@/types';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek
} from 'date-fns';

export default function LeaveCalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await getLeaves();
        if (!cancelled) setLeaves(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const daysInGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveRecord[]>();
    leaves.forEach(l => {
      const existing = map.get(l.date) || [];
      existing.push(l);
      map.set(l.date, existing);
    });
    return map;
  }, [leaves]);

  const selectedDateLeaves = useMemo(() => {
    if (!selectedDate) return [];
    return leavesByDate.get(format(selectedDate, 'yyyy-MM-dd')) || [];
  }, [selectedDate, leavesByDate]);

  const leavesTodayCount = useMemo(() => {
    return leavesByDate.get(format(new Date(), 'yyyy-MM-dd'))?.length || 0;
  }, [leavesByDate]);

  return (
    <div className="relative flex flex-col">

      {/* Header — Leave Calendar / N on leave today */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex flex-col">
          <h3 className="text-[13px] font-bold text-white tracking-tight">Leave Calendar</h3>
          <span className="text-[10px] font-medium text-white/40 mt-0.5">
            {leavesTodayCount} on leave today
          </span>
        </div>
        <span className={`flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md text-[11px] font-bold tabular-nums ${
          leavesTodayCount > 0
            ? 'bg-[var(--rose)]/12 text-[var(--rose)] border border-[var(--rose)]/25'
            : 'bg-white/[0.04] text-white/40 border border-white/[0.08]'
        }`}>
          {leavesTodayCount}
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 mb-2">
        <motion.button
          whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
          onClick={prevMonth}
          className="p-1.5 text-white/35 hover:text-white transition-colors"
        >
          <ChevronLeft size={15} />
        </motion.button>
        <span className="text-[12px] font-semibold text-white tabular-nums">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <motion.button
          whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
          onClick={nextMonth}
          className="p-1.5 text-white/35 hover:text-white transition-colors"
        >
          <ChevronRight size={15} />
        </motion.button>
      </div>

      {/* Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-7 gap-1 mb-4 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <div key={i} className="text-[8px] font-black text-white/10 uppercase py-2">
              {day}
            </div>
          ))}
          
          {daysInGrid.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayLeaves = leavesByDate.get(dateStr) || [];
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const hasLeaves = dayLeaves.length > 0;
            const hasUnplanned = dayLeaves.some(l => !l.is_planned);
            
            return (
              <motion.button
                key={i}
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDate(date)}
                className={`relative h-10 rounded-lg flex flex-col items-center justify-center transition-all duration-300 border ${
                  isSelected 
                    ? 'bg-white/10 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                    : isTodayDate 
                      ? 'bg-white/[0.03] border-white/10 text-white' 
                      : 'border-transparent'
                } ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : ''}`}
              >
                <span className={`text-[11px] font-mono font-black ${isSelected ? 'text-white' : isTodayDate ? 'text-white' : 'text-white/40'}`}>
                  {format(date, 'd')}
                </span>
                
                {hasLeaves && (
                  <div className="absolute bottom-1.5 flex gap-1">
                    <div className={`w-1 h-1 rounded-full ${hasUnplanned ? 'bg-[var(--rose)] shadow-[0_0_5px_var(--rose)]' : 'bg-sky-400 shadow-[0_0_5px_theme(colors.sky.400)]'}`} />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Selected Architecture Breakdown */}
        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 pt-6 border-t border-white/[0.03] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-white/20 rounded-full" />
                  <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                    {format(selectedDate, 'MMM dd')}
                  </span>
                </div>
                <div className="text-[8px] font-black text-white/20 bg-white/[0.03] px-2 py-0.5 rounded uppercase tracking-tighter">
                  {selectedDateLeaves.length} UNITS
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {selectedDateLeaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 bg-white/[0.02] rounded-xl border border-dashed border-white/5">
                    <UserCheck size={14} className="text-white/5" />
                    <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Optimal Attendance</span>
                  </div>
                ) : (
                  selectedDateLeaves.map((leave, idx) => (
                    <motion.div 
                      key={leave.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-full transition-all duration-300 ${leave.is_planned ? 'bg-sky-500/30' : 'bg-[var(--rose)]/30 group-hover:bg-[var(--rose)]'}`} />
                      
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-white tracking-tight">{leave.employee_name}</span>
                        <div className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${leave.is_planned ? 'text-sky-400 bg-sky-400/10' : 'text-[var(--rose)] bg-[var(--rose)]/10'}`}>
                          {leave.is_planned ? 'PLANNED' : 'URGENT'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black uppercase tracking-tighter">{leave.client_name}</span>
                        <span className="text-[8px] font-bold italic">{leave.leave_type}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

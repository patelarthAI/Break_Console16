'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Coffee,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Award,
  Flame,
  Zap,
} from 'lucide-react';
import { User, TimeLog, LeaveRecord } from '@/types';
import { getLogsBatch, getLeaves } from '@/lib/store';
import { checkViolations, getRealDate, dateStr, isWorkDay } from '@/lib/timeUtils';

interface MonthlyPulseProps {
  user: User;
  compact?: boolean;
}

interface MonthMetrics {
  monthName: string;
  year: number;
  totalLeaves: number;
  leaveDaysList: string[];
  weekdaysElapsed: number;
  daysPresent: number;
  lateInDays: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  breakViolDays: number;
  totalBreakExceedMinutes: number;
  avgBreakWhenExceededMinutes: number;
  avgDailyBreakMinutes: number;
  cleanDays: number;
  complianceRate: number;
}

export default function MonthlyPulse({ user, compact = false }: MonthlyPulseProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MonthMetrics | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMonthlyData() {
      try {
        setLoading(true);
        const now = getRealDate();
        const year = now.getFullYear();
        const month = now.getMonth();
        const todayStr = dateStr(now);
        const monthName = now.toLocaleString('en-US', { month: 'long' });

        // Generate all Mon-Fri dates in the current month up to today
        const weekdaysElapsed: string[] = [];
        for (let d = 1; d <= now.getDate(); d++) {
          const cur = new Date(year, month, d);
          const ds = dateStr(cur);
          if (ds <= todayStr && isWorkDay(ds)) {
            weekdaysElapsed.push(ds);
          }
        }

        if (weekdaysElapsed.length === 0) {
          if (isMounted) setLoading(false);
          return;
        }

        // Fetch logs for this user across all elapsed weekdays this month
        const [logsBatch, leavesData] = await Promise.all([
          getLogsBatch([user.id], weekdaysElapsed),
          getLeaves(user.clientName).catch(() => [] as LeaveRecord[]),
        ]);

        // Filter leaves specifically for this employee in the current month
        const userLeaves = leavesData.filter(l => {
          const matchesUser =
            l.employee_name.toLowerCase().trim() === user.name.toLowerCase().trim();
          const isThisMonth = l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
          return matchesUser && isThisMonth;
        });

        const leaveDaysSet = new Set(userLeaves.map(l => l.date));
        const totalLeaves = userLeaves.reduce((sum, l) => sum + (Number(l.day_count) || 1), 0);

        let daysPresent = 0;
        let lateInDays = 0;
        let totalLateMinutes = 0;
        let breakViolDays = 0;
        let totalBreakExceedMs = 0;
        let totalCombinedBreakOnViolDays = 0;
        let totalMonthlyCombinedBreakMs = 0;
        let cleanDays = 0;

        const COMBINED_LIMIT_MS = 85 * 60 * 1000;

        for (const day of weekdaysElapsed) {
          const key = `${user.id}-${day}`;
          const dayLogs: TimeLog[] = logsBatch[key] || [];

          if (dayLogs.length === 0) continue;
          daysPresent++;

          let punchIn: number | undefined;
          let punchOut: number | undefined;
          let breakStart: number | null = null;
          let brbStart: number | null = null;
          let dayBreakMs = 0;
          let dayBrbMs = 0;

          // Sequential state-machine pass for day logs
          for (const log of dayLogs) {
            if (log.eventType === 'punch_in' && !punchIn) punchIn = log.timestamp;
            if (log.eventType === 'punch_out') punchOut = log.timestamp;
            if (log.eventType === 'break_start') breakStart = log.timestamp;
            if (log.eventType === 'break_end' && breakStart !== null) {
              dayBreakMs += log.timestamp - breakStart;
              breakStart = null;
            }
            if (log.eventType === 'brb_start') brbStart = log.timestamp;
            if (log.eventType === 'brb_end' && brbStart !== null) {
              dayBrbMs += log.timestamp - brbStart;
              brbStart = null;
            }
          }

          const dayCombinedBreakMs = dayBreakMs + dayBrbMs;
          totalMonthlyCombinedBreakMs += dayCombinedBreakMs;

          const violations = checkViolations(
            dayBreakMs,
            dayBrbMs,
            punchIn,
            punchOut,
            user.shiftStart,
            user.shiftEnd,
            user.timezone,
            dayLogs
          );

          let hasViolationToday = false;

          // Late Login tracking
          if (violations.lateIn) {
            lateInDays++;
            hasViolationToday = true;
            const lateMins = Math.max(1, Math.round(violations.lateInMs / 60000));
            totalLateMinutes += lateMins;
          }

          // Combined break exceed (Break + BRB > 85m)
          if (dayCombinedBreakMs > COMBINED_LIMIT_MS) {
            breakViolDays++;
            hasViolationToday = true;
            const excess = dayCombinedBreakMs - COMBINED_LIMIT_MS;
            totalBreakExceedMs += excess;
            totalCombinedBreakOnViolDays += dayCombinedBreakMs;
          }

          if (!hasViolationToday) {
            cleanDays++;
          }
        }

        const avgLateMinutes = lateInDays > 0 ? Math.round(totalLateMinutes / lateInDays) : 0;
        const totalBreakExceedMinutes = Math.round(totalBreakExceedMs / 60000);
        const avgBreakWhenExceededMinutes =
          breakViolDays > 0 ? Math.round(totalCombinedBreakOnViolDays / breakViolDays / 60000) : 0;
        const avgDailyBreakMinutes =
          daysPresent > 0 ? Math.round(totalMonthlyCombinedBreakMs / daysPresent / 60000) : 0;

        const complianceRate =
          daysPresent > 0
            ? Math.max(
                0,
                Math.round(
                  ((daysPresent - lateInDays * 0.5 - breakViolDays * 0.5) / daysPresent) * 100
                )
              )
            : 100;

        if (isMounted) {
          setMetrics({
            monthName,
            year,
            totalLeaves,
            leaveDaysList: Array.from(leaveDaysSet),
            weekdaysElapsed: weekdaysElapsed.length,
            daysPresent,
            lateInDays,
            totalLateMinutes,
            avgLateMinutes,
            breakViolDays,
            totalBreakExceedMinutes,
            avgBreakWhenExceededMinutes,
            avgDailyBreakMinutes,
            cleanDays,
            complianceRate,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('[MonthlyPulse] Failed to compute monthly recruiter stats:', err);
        if (isMounted) setLoading(false);
      }
    }

    void loadMonthlyData();

    return () => {
      isMounted = false;
    };
  }, [user.id, user.name, user.clientName, user.shiftStart, user.shiftEnd, user.timezone]);

  if (loading) {
    return (
      <div className="w-full mt-4 p-5 rounded-2xl border border-white/10 bg-[#0d0b1a]/90 backdrop-blur-2xl">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-white/5" />
          <div className="h-4 w-48 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  if (compact) {
    return (
      <div className="w-full h-full flex flex-col p-3.5 overflow-y-auto">
        {/* Compact Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-white font-mono">
              {metrics.monthName} Performance
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[8.5px] font-black text-emerald-400 font-mono">
              {metrics.complianceRate}% COMPLIANCE
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {metrics.daysPresent}/{metrics.weekdaysElapsed} Days Present
          </span>
        </div>

        {/* 2x3 Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
          {/* Card 1: Leaves */}
          <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
            <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Total Leaves</span>
            <div className="text-base font-black text-white font-mono">{metrics.totalLeaves}d</div>
            <div className="text-[8.5px] text-slate-500 font-mono">{metrics.totalLeaves === 0 ? 'Zero leaves' : 'Approved'}</div>
          </div>
          {/* Card 2: Late Logins */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${metrics.lateInDays > 0 ? 'border-rose-500/30 bg-rose-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
            <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Late Logins</span>
            <div className={`text-base font-black font-mono ${metrics.lateInDays > 0 ? 'text-rose-400' : 'text-white'}`}>{metrics.lateInDays}d</div>
            <div className="text-[8.5px] text-slate-500 font-mono">{metrics.lateInDays === 0 ? 'Zero tardy' : 'Past grace'}</div>
          </div>
          {/* Card 3: Avg Late */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${metrics.avgLateMinutes > 0 ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
            <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Avg Delay</span>
            <div className={`text-base font-black font-mono ${metrics.avgLateMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{metrics.avgLateMinutes > 0 ? `${metrics.avgLateMinutes}m` : '0m'}</div>
            <div className="text-[8.5px] text-slate-500 font-mono">When late</div>
          </div>
          {/* Card 4: Break Violations */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${metrics.breakViolDays > 0 ? 'border-rose-500/30 bg-rose-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
            <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Break Violations</span>
            <div className={`text-base font-black font-mono ${metrics.breakViolDays > 0 ? 'text-rose-400' : 'text-white'}`}>{metrics.breakViolDays}d</div>
            <div className="text-[8.5px] text-slate-500 font-mono">&gt; 85m total</div>
          </div>
          {/* Card 5: Total Overtime */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${metrics.totalBreakExceedMinutes > 0 ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
            <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Overtime Excess</span>
            <div className={`text-base font-black font-mono ${metrics.totalBreakExceedMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{metrics.totalBreakExceedMinutes > 0 ? `${metrics.totalBreakExceedMinutes}m` : '0m'}</div>
            <div className="text-[8.5px] text-slate-500 font-mono">Past 85m limit</div>
          </div>
          {/* Card 6: Avg When Exceeded */}
          <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
            <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Avg Exceeded</span>
            <div className="text-base font-black font-mono text-purple-300">{metrics.avgBreakWhenExceededMinutes > 0 ? `${metrics.avgBreakWhenExceededMinutes}m` : 'None'}</div>
            <div className="text-[8.5px] text-slate-500 font-mono">On viol days</div>
          </div>
        </div>

        {/* Footnote */}
        <div className="mt-2 pt-2 flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-white/[0.04]">
          <span>Daily Avg: <strong className="text-white">{metrics.avgDailyBreakMinutes}m/d</strong></span>
          <span className="text-emerald-400">{metrics.cleanDays} Perfect Shifts</span>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Monthly Recruiter Telemetry"
      className="w-full mt-3 p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-3xl"
      style={{
        background: 'linear-gradient(160deg, rgba(14, 11, 28, 0.96) 0%, rgba(7, 5, 16, 0.98) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Top Laser Accent Strip */}
      <div
        className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 245, 160, 0.8) 30%, rgba(167, 139, 250, 0.8) 70%, transparent 100%)',
        }}
      />

      {/* ══════════ DECK HEADER ══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl border border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(0,245,160,0.25)] text-emerald-400">
            <Calendar size={15} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-mono">
                {metrics.monthName} {metrics.year} Cockpit
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black text-emerald-400 font-mono tracking-widest">
                MONTHLY TELEMETRY
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Real-time shift presence, leave audits & break policy telemetry
            </p>
          </div>
        </div>

        {/* Right Badge: Compliance Rating */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03]">
            <Award size={13} className="text-amber-400" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Compliance</span>
              <span className="text-xs font-black font-mono text-emerald-400">
                {metrics.complianceRate}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-mono text-slate-300">
            <span className="text-slate-400">Present:</span>
            <span className="font-bold text-white">{metrics.daysPresent}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{metrics.weekdaysElapsed}d</span>
          </div>
        </div>
      </div>

      {/* ══════════ METRICS BENTO TILES ══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        
        {/* CARD 1: Total Leaves */}
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Total Leaves
            </span>
            <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-blue-500/15 text-blue-400">
              <Calendar size={11} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono tracking-tight">
              {metrics.totalLeaves} {metrics.totalLeaves === 1 ? 'day' : 'days'}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              {metrics.totalLeaves === 0 ? 'Zero leaves logged' : 'Approved record'}
            </div>
          </div>
        </div>

        {/* CARD 2: Total Late Login Days */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            metrics.lateInDays > 0
              ? 'border-rose-500/30 bg-rose-500/[0.04]'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Late Logins
            </span>
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                metrics.lateInDays > 0
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <Clock size={11} />
            </div>
          </div>
          <div>
            <div
              className={`text-lg font-black font-mono tracking-tight ${
                metrics.lateInDays > 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {metrics.lateInDays} {metrics.lateInDays === 1 ? 'day' : 'days'}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              {metrics.lateInDays === 0 ? '100% on-time starts' : 'Past +5m grace cutoff'}
            </div>
          </div>
        </div>

        {/* CARD 3: Average Late Arrival */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            metrics.avgLateMinutes > 0
              ? 'border-amber-500/30 bg-amber-500/[0.04]'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Avg Late Delay
            </span>
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                metrics.avgLateMinutes > 0
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <TrendingUp size={11} />
            </div>
          </div>
          <div>
            <div
              className={`text-lg font-black font-mono tracking-tight ${
                metrics.avgLateMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {metrics.avgLateMinutes > 0 ? `${metrics.avgLateMinutes}m` : '0m'}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              {metrics.avgLateMinutes > 0 ? 'Mean delay when late' : 'Punctual baseline'}
            </div>
          </div>
        </div>

        {/* CARD 4: Break Exceed Violations */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            metrics.breakViolDays > 0
              ? 'border-rose-500/30 bg-rose-500/[0.04]'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Break Violations
            </span>
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                metrics.breakViolDays > 0
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <AlertTriangle size={11} />
            </div>
          </div>
          <div>
            <div
              className={`text-lg font-black font-mono tracking-tight ${
                metrics.breakViolDays > 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {metrics.breakViolDays} {metrics.breakViolDays === 1 ? 'day' : 'days'}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              Combined Break &gt; 85m
            </div>
          </div>
        </div>

        {/* CARD 5: Total Break Exceeded Time */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            metrics.totalBreakExceedMinutes > 0
              ? 'border-amber-500/30 bg-amber-500/[0.04]'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Total Overtime
            </span>
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                metrics.totalBreakExceedMinutes > 0
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <Flame size={11} />
            </div>
          </div>
          <div>
            <div
              className={`text-lg font-black font-mono tracking-tight ${
                metrics.totalBreakExceedMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {metrics.totalBreakExceedMinutes > 0 ? `${metrics.totalBreakExceedMinutes}m` : '0m'}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              Excess past 85m limit
            </div>
          </div>
        </div>

        {/* CARD 6: Avg Break When Exceeded */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            metrics.avgBreakWhenExceededMinutes > 0
              ? 'border-purple-500/30 bg-purple-500/[0.04]'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Avg When Exceeded
            </span>
            <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-purple-500/15 text-purple-400">
              <Coffee size={11} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black font-mono tracking-tight text-purple-300">
              {metrics.avgBreakWhenExceededMinutes > 0
                ? `${metrics.avgBreakWhenExceededMinutes}m`
                : 'None'}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              Mean total on viol days
            </div>
          </div>
        </div>

      </div>

      {/* ══════════ BOTTOM TELEMETRY FOOTNOTE ══════════ */}
      <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-emerald-400" />
            <span>Policy: Standard Break (60m) + BRB (10m) • Combined Hard Cap (85m)</span>
          </span>
          <span className="hidden sm:inline-block text-slate-600">•</span>
          <span className="hidden sm:inline-flex items-center gap-1">
            <span>Daily Average:</span>
            <strong className="text-white font-bold">{metrics.avgDailyBreakMinutes}m / day</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-bold">
            {metrics.cleanDays} Perfect {metrics.cleanDays === 1 ? 'Shift' : 'Shifts'}
          </span>
        </div>
      </div>
    </section>
  );
}

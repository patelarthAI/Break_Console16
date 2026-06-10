'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Hourglass, Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { User, TimeLog } from '@/types';

interface ControlCenterProps {
  now: number;
  user: User;
  status: string;
  workedMs: number;
  breakMs: number;
  brbMs: number;
  onAction: (a: string) => void;
  logs: TimeLog[];
}

const S = {
  working:     { label: 'Working',     color: '#00F5A0', themeGlow: 'rgba(0, 245, 160, 0.12)', gradient: 'linear-gradient(135deg, #00F5A0 0%, #00D9F5 100%)' },
  on_break:    { label: 'On Break',    color: '#FBBF24', themeGlow: 'rgba(251, 191, 36, 0.12)', gradient: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)' },
  on_brb:      { label: 'BRB',         color: '#A78BFA', themeGlow: 'rgba(167, 139, 250, 0.12)', gradient: 'linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)' },
  punched_out: { label: 'Clocked Out', color: '#6B7280', themeGlow: 'rgba(107, 114, 128, 0.06)', gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)' },
  idle:        { label: 'Not Started', color: '#FF2D55', themeGlow: 'rgba(255, 45, 85, 0.12)', gradient: 'linear-gradient(135deg, #FF2D55 0%, #D946EF 100%)' },
} as const;

// Format duration to clean "Xh Ym" or "Ym" (no seconds)
function formatMsToHrMin(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

export default function ControlCenter({ now, user, status, workedMs, breakMs, brbMs, logs }: ControlCenterProps) {
  const [mounted, setMounted] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  // 60FPS high-precision timer loop for smooth liquid sweeps
  const [localNow, setLocalNow] = useState(now);
  const offsetRef = useRef(now - Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    offsetRef.current = now - Date.now();
  }, [now]);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      setLocalNow(Date.now() + offsetRef.current);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      active = false;
    };
  }, []);

  // Detect session ends and show completed toast
  useEffect(() => {
    if (prevStatus !== status) {
      if (status === 'working' || status === 'punched_out') {
        if (prevStatus === 'on_break' || prevStatus === 'on_brb') {
          const type = prevStatus === 'on_break' ? 'Break' : 'BRB';
          const startType = prevStatus === 'on_break' ? 'break_start' : 'brb_start';
          const endType = prevStatus === 'on_break' ? 'break_end' : 'punch_out';
          
          const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
          const endLog = sorted.find(l => l.eventType === endType || l.eventType === 'punch_out' || l.eventType === 'auto_logout');
          const startLog = sorted.find(l => l.eventType === startType && (!endLog || l.timestamp < endLog.timestamp));
          
          if (startLog) {
            const endTs = endLog ? endLog.timestamp : now;
            const duration = endTs - startLog.timestamp;
            const durationStr = formatMsToHrMin(duration);
            setToast({
              text: `${type} Completed: ${durationStr}`,
              id: Date.now()
            });
          }
        }
      }
      setPrevStatus(status);
    }
  }, [status, prevStatus, logs, now]);

  useEffect(() => {
    if (toast) {
      const tId = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(tId);
    }
  }, [toast]);

  const st = S[status as keyof typeof S] ?? S.idle;
  const tz = user?.timezone ?? 'America/Chicago';
  
  const isWorking = status === 'working';
  const isOnBreak = status === 'on_break';
  const isOnBrb   = status === 'on_brb';

  const totalBreak = breakMs + brbMs;

  // ─── Wall Clock Time calculation ───
  const t = useMemo(() => {
    if (!mounted) return { hh: '00', mm: '00', amPm: 'AM', weekday: '', day: '', month: '' };
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true,
      }).formatToParts(new Date(localNow));
      const dp = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', month: 'short', day: 'numeric',
      }).formatToParts(new Date(localNow));
      
      const g = (k: string) => parts.find(p => p.type === k)?.value ?? '00';
      const dg = (k: string) => dp.find(p => p.type === k)?.value ?? '';
      
      return {
        hh: g('hour'), mm: g('minute'),
        amPm: parts.find(p => p.type === 'dayPeriod')?.value.toUpperCase() ?? 'AM',
        weekday: dg('weekday'), month: dg('month').toUpperCase(), day: dg('day')
      };
    } catch {
      const d = new Date(localNow), h = d.getHours();
      const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      const mo = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
      return {
        hh: String(h % 12 || 12).padStart(2, '0'), mm: String(d.getMinutes()).padStart(2, '0'),
        amPm: h >= 12 ? 'PM' : 'AM', weekday: wd, month: mo, day: String(d.getDate())
      };
    }
  }, [localNow, tz, mounted]);

  // ─── Active Session Timer calculation ───
  const currentSessionStart = useMemo(() => {
    if (!logs || !logs.length) return null;
    if (status === 'on_break') {
      const lastBreakStart = [...logs].reverse().find(l => l.eventType === 'break_start');
      return lastBreakStart ? lastBreakStart.timestamp : null;
    }
    if (status === 'on_brb') {
      const lastBrbStart = [...logs].reverse().find(l => l.eventType === 'brb_start');
      return lastBrbStart ? lastBrbStart.timestamp : null;
    }
    return null;
  }, [logs, status]);

  const activeSessionMs = useMemo(() => {
    if (!currentSessionStart) return 0;
    return Math.max(0, localNow - currentSessionStart);
  }, [localNow, currentSessionStart]);

  // ─── Color-Coded Alert System ───
  const breakAlert = useMemo(() => {
    const mins = breakMs / 60000;
    if (mins >= 75) return { color: '#FF2D55', label: 'DANGER', level: 'danger', gradient: 'linear-gradient(90deg, #FF2D55 0%, #B91C1C 100%)' };
    if (mins >= 60) return { color: '#FBBF24', label: 'WARNING', level: 'warning', gradient: 'linear-gradient(90deg, #FBBF24 0%, #D97706 100%)' };
    return { color: '#00F5A0', label: 'OPTIMAL', level: 'safe', gradient: 'linear-gradient(90deg, #00F5A0 0%, #059669 100%)' };
  }, [breakMs]);

  const brbAlert = useMemo(() => {
    const mins = brbMs / 60000;
    if (mins >= 15) return { color: '#FF2D55', label: 'DANGER', level: 'danger', gradient: 'linear-gradient(90deg, #FF2D55 0%, #B91C1C 100%)' };
    if (mins >= 10) return { color: '#FBBF24', label: 'WARNING', level: 'warning', gradient: 'linear-gradient(90deg, #FBBF24 0%, #D97706 100%)' };
    return { color: '#A78BFA', label: 'NORMAL', level: 'safe', gradient: 'linear-gradient(90deg, #A78BFA 0%, #6D28D9 100%)' };
  }, [brbMs]);

  const combinedAlert = useMemo(() => {
    const mins = totalBreak / 60000;
    if (mins >= 85) return { color: '#FF2D55', label: 'CRITICAL', level: 'danger', gradient: 'linear-gradient(90deg, #FF2D55 0%, #B91C1C 100%)' };
    if (mins >= 70) return { color: '#FBBF24', label: 'SURPLUS', level: 'warning', gradient: 'linear-gradient(90deg, #FBBF24 0%, #D97706 100%)' };
    return { color: 'rgba(255,255,255,0.25)', label: 'STABLE', level: 'safe', gradient: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%)' };
  }, [totalBreak]);

  // ─── Dual SVG Ring Parameter calculations (at 60fps) ───
  const CX = 120, CY = 120;
  const R_OUT = 100; // Outer fast seconds ring
  const R_IN = 86;   // Inner slow progress ring
  const circOut = 2 * Math.PI * R_OUT;
  const circIn = 2 * Math.PI * R_IN;

  const dateObj = new Date(localNow);
  // Use Date.now() directly for sub-second precision — avoids offset drift
  const realNowDate = new Date();
  const msFraction = realNowDate.getMilliseconds() / 1000;
  
  // Outer second progress (sweeps smoothly once per minute)
  const outerProgress = (realNowDate.getSeconds() + msFraction) / 60;
  const outerDashArray = `${outerProgress * circOut} ${circOut}`;

  // Inner slow progress
  const innerProgress = useMemo(() => {
    if (currentSessionStart) {
      const limit = status === 'on_break' ? 75 * 60 * 1000 : 15 * 60 * 1000;
      return Math.min(activeSessionMs / limit, 1);
    }
    // Wall clock mode: progress of the current hour
    return (dateObj.getMinutes() + dateObj.getSeconds() / 60) / 60;
  }, [currentSessionStart, activeSessionMs, status, localNow]);

  const innerDashArray = `${innerProgress * circIn} ${circIn}`;

  // 60-tick clock dial markings
  const ticks = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => {
      const angle = (i * 6) * Math.PI / 180;
      const isMajor = i % 5 === 0;
      const rStart = isMajor ? 107 : 110;
      const rEnd = 114;
      const x1 = 120 + rStart * Math.cos(angle);
      const y1 = 120 + rStart * Math.sin(angle);
      const x2 = 120 + rEnd * Math.cos(angle);
      const y2 = 120 + rEnd * Math.sin(angle);
      return { x1, y1, x2, y2, isMajor, key: i };
    });
  }, []);

  const activeTickIndex = Math.floor(outerProgress * 60);

  return (
    <div 
      style={{
        flex: 1,
        height: '100%',
        background: `linear-gradient(160deg, rgba(11,10,24,0.98) 0%, rgba(6,5,15,1) 100%)`,
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 64px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)`,
        fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif"
      }}
    >
      
      {/* ─── Apple-Grade Kinetic Keyframe Styles ─── */}
      <style>{`
        /* Core breathing pulsar animations */
        @keyframes pulsar-working {
          0%, 100% { transform: scale(0.94); opacity: 0.12; }
          50% { transform: scale(1.03); opacity: 0.22; filter: drop-shadow(0 0 14px rgba(0, 245, 160, 0.45)); }
        }
        @keyframes pulsar-break {
          0%, 100% { transform: scale(0.92); opacity: 0.12; }
          50% { transform: scale(1.05); opacity: 0.24; filter: drop-shadow(0 0 16px rgba(251, 191, 36, 0.45)); }
        }
        @keyframes pulsar-brb {
          0%, 100% { transform: scale(0.88); opacity: 0.14; }
          45% { transform: scale(1.08); opacity: 0.28; filter: drop-shadow(0 0 18px rgba(167, 139, 250, 0.50)); }
          55% { transform: scale(1.01); opacity: 0.20; }
          75% { transform: scale(1.12); opacity: 0.32; filter: drop-shadow(0 0 20px rgba(167, 139, 250, 0.55)); }
        }

        .pulsar-core-working { animation: pulsar-working 4s ease-in-out infinite; }
        .pulsar-core-on_break { animation: pulsar-break 3.5s ease-in-out infinite; }
        .pulsar-core-on_brb { animation: pulsar-brb 2.2s cubic-bezier(0.25, 0.8, 0.25, 1) infinite; }
        .pulsar-core-punched_out,
        .pulsar-core-idle {
          transform: scale(0.94);
          opacity: 0.06;
        }

        /* Ambient glows for telemetry cards */
        .telemetry-card {
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          background: rgba(255, 255, 255, 0.012);
          border: 1px solid rgba(255, 255, 255, 0.04);
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03);
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .telemetry-card:hover {
          background: rgba(255, 255, 255, 0.024);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 16px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04);
          transform: translateY(-1.5px);
        }
      `}</style>

      {/* ══════════ FLOATING HUD CHRONOMETER (Apple-Style Minimal Hologram) ══════════ */}
      <div 
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          flex: 1,
          justifyContent: 'center',
          paddingTop: 0,
          minHeight: 0,
        }}
      >
        {/* Deep background state-colored aurora */}
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'absolute',
              width: 320, height: 320,
              top: '50%', left: '50%',
              translateX: '-50%', translateY: '-50%',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${st.themeGlow} 0%, transparent 70%)`,
              filter: 'blur(36px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        </AnimatePresence>

        {/* Transition popup bubble */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.94, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, scale: 0.94, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 480, damping: 26 }}
              style={{
                position: 'absolute',
                top: 0,
                zIndex: 100,
                padding: '6px 14px',
                borderRadius: 100,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.65), 0 0 16px rgba(0, 245, 160, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={11} style={{ color: '#00F5A0' }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', color: '#fff', fontFamily: "'Satoshi', sans-serif" }}>
                {toast.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top date HUD projection */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.3)', fontFamily: "'Satoshi', sans-serif" }}>
            {t.weekday} · {t.month} {t.day}
          </span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          <AnimatePresence mode="wait">
            <motion.span
              key={status}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 3 }}
              style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: '0.14em', color: st.color, textTransform: 'uppercase', fontFamily: "'Satoshi', sans-serif" }}
            >
              {st.label}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Dial Face */}
        <div style={{ position: 'relative', width: 230, height: 230, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          <svg width="230" height="230" viewBox="0 0 240 240" style={{ position: 'absolute', transform: 'rotate(-90deg)', overflow: 'visible' }}>
            <defs>
              <linearGradient id="ring-grad-working" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F5A0" />
                <stop offset="100%" stopColor="#00D9F5" />
              </linearGradient>
              <linearGradient id="ring-grad-break" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
              <linearGradient id="ring-grad-brb" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>

              {/* Dynamic Gradient mapping based on state */}
              <linearGradient id="pulsar-grad-working" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(0, 245, 160, 0.16)" />
                <stop offset="100%" stopColor="rgba(0, 217, 245, 0.01)" />
              </linearGradient>
              <linearGradient id="pulsar-grad-break" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(251, 191, 36, 0.16)" />
                <stop offset="100%" stopColor="rgba(249, 115, 16, 0.01)" />
              </linearGradient>
              <linearGradient id="pulsar-grad-brb" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(167, 139, 250, 0.16)" />
                <stop offset="100%" stopColor="rgba(236, 72, 153, 0.01)" />
              </linearGradient>
              <linearGradient id="pulsar-grad-neutral" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.06)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.0)" />
              </linearGradient>
            </defs>

            {/* ─── Backing Glass Plate ─── */}
            <circle
              cx="120" cy="120" r="116"
              fill="rgba(255, 255, 255, 0.005)"
              stroke="rgba(255, 255, 255, 0.02)"
              strokeWidth="1"
            />

            {/* ─── Inner backing glass disc ─── */}
            <circle
              cx="120" cy="120" r="74"
              fill="rgba(255, 255, 255, 0.01)"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth="0.8"
            />

            {/* ─── Dynamic Chronograph Ticks ─── */}
            {ticks.map((tick, idx) => {
              const isPassed = idx <= activeTickIndex;
              return (
                <line
                  key={tick.key}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  stroke={isPassed ? st.color : 'rgba(255, 255, 255, 0.06)'}
                  strokeWidth={tick.isMajor ? (isPassed ? 1.6 : 1.0) : (isPassed ? 1.0 : 0.6)}
                  style={{
                    transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
                    filter: isPassed && tick.isMajor ? `drop-shadow(0 0 2px ${st.color}80)` : 'none'
                  }}
                />
              );
            })}

            {/* ─── PULSAR CORE (Inner breathing aura) ─── */}
            <circle
              cx="120" cy="120" r="54"
              fill={
                status === 'working' ? 'url(#pulsar-grad-working)' :
                status === 'on_break' ? 'url(#pulsar-grad-break)' :
                status === 'on_brb' ? 'url(#pulsar-grad-brb)' :
                'url(#pulsar-grad-neutral)'
              }
              className={`pulsar-core-${status}`}
              style={{ transformOrigin: '120px 120px' }}
            />

            {/* ─── OUTER SMOOTH SECONDS RING ─── */}
            <circle
              cx="120" cy="120" r={R_OUT}
              stroke="rgba(255, 255, 255, 0.012)"
              strokeWidth="1.0"
              fill="none"
            />
            <circle
              cx="120" cy="120" r={R_OUT}
              stroke={st.color}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={outerDashArray}
              style={{
                filter: `drop-shadow(0 0 5px ${st.color})`,
                opacity: 0.75,
              }}
            />

            {/* ─── INNER PROGRESS RING (Anti-aliased glow) ─── */}
            <circle
              cx="120" cy="120" r={R_IN}
              stroke="rgba(255, 255, 255, 0.01)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="120" cy="120" r={R_IN}
              stroke={
                status === 'working' ? 'url(#ring-grad-working)' :
                status === 'on_break' ? 'url(#ring-grad-break)' :
                status === 'on_brb' ? 'url(#ring-grad-brb)' :
                'rgba(255,255,255,0.08)'
              }
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={innerDashArray}
              style={{
                filter: `drop-shadow(0 0 6px ${st.color}30)`
              }}
            />

            {/* Orbiting particle node stack on outer second ring */}
            {mounted && (
              <g style={{ filter: `drop-shadow(0 0 5px ${st.color})` }}>
                <circle
                  cx={CX + R_OUT * Math.cos((outerProgress * 2 * Math.PI) - Math.PI / 2)}
                  cy={CY + R_OUT * Math.sin((outerProgress * 2 * Math.PI) - Math.PI / 2)}
                  r="7"
                  fill={st.color}
                  opacity="0.25"
                />
                <circle
                  cx={CX + R_OUT * Math.cos((outerProgress * 2 * Math.PI) - Math.PI / 2)}
                  cy={CY + R_OUT * Math.sin((outerProgress * 2 * Math.PI) - Math.PI / 2)}
                  r="4.5"
                  fill={st.color}
                  opacity="0.7"
                />
                <circle
                  cx={CX + R_OUT * Math.cos((outerProgress * 2 * Math.PI) - Math.PI / 2)}
                  cy={CY + R_OUT * Math.sin((outerProgress * 2 * Math.PI) - Math.PI / 2)}
                  r="2"
                  fill="#fff"
                />
              </g>
            )}
          </svg>

          {/* Time digits text */}
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', pointerEvents: 'none' }}>
            <AnimatePresence mode="wait">
              {currentSessionStart ? (
                // ─── Stopwatch mode ───
                <motion.div
                  key="stopwatch"
                  initial={{ opacity: 0, scale: 0.94, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.94, filter: 'blur(3px)' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: st.color, fontFamily: "'Satoshi', sans-serif", marginBottom: 2 }}>
                    {status === 'on_break' ? 'BREAK' : 'BRB'}
                  </span>
                  
                  <span 
                    style={{
                      fontSize: 38,
                      fontWeight: 800,
                      color: '#fff',
                      fontFamily: "'Satoshi', sans-serif",
                      letterSpacing: '-0.04em',
                      lineHeight: 1,
                      textShadow: `0 0 16px ${st.color}45`,
                    }}
                  >
                    {formatMsToHrMin(activeSessionMs)}
                  </span>

                  <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', fontFamily: "'Satoshi', sans-serif", marginTop: 4 }}>
                    {tz.split('/')[1]?.replace('_', ' ') ?? tz}
                  </span>
                </motion.div>
              ) : (
                // ─── Wall clock mode ───
                <motion.div
                  key="clock"
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.95, filter: 'blur(3px)' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'Satoshi', sans-serif", marginBottom: 2 }}>
                    SYSTEM TIME
                  </span>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span 
                      style={{
                        fontSize: 42,
                        fontWeight: 800,
                        color: '#fff',
                        lineHeight: 1,
                        fontFamily: "'Satoshi', sans-serif",
                        letterSpacing: '-0.04em',
                        textShadow: `0 0 16px ${st.color}35`,
                      }}
                    >
                      {t.hh}:{t.mm}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: "'Satoshi', sans-serif",
                      letterSpacing: '0.04em',
                    }}>{t.amPm}</span>
                  </div>

                  <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', fontFamily: "'Satoshi', sans-serif", marginTop: 4 }}>
                    {tz.split('/')[1]?.replace('_', ' ') ?? tz}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ══════════ 2x2 TELEMETRY GRID (Clean borderless glass HUD) ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
        
        {/* ROW 1 LEFT: Break Time */}
        <div 
          className="telemetry-card"
          style={{
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            height: 68,
            overflow: 'hidden',
          }}
        >
          {/* Pulsing Status Bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: breakAlert.color,
            boxShadow: `0 0 8px ${breakAlert.color}`,
            animation: isOnBreak ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Coffee size={10} style={{ color: breakAlert.color }} />
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontFamily: "'Satoshi', sans-serif" }}>BREAK TIME</span>
            </div>
            {isOnBreak && <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: breakAlert.color, boxShadow: `0 0 6px ${breakAlert.color}` }} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "'Satoshi', sans-serif",
              color: breakAlert.level === 'safe' ? '#fff' : breakAlert.color,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>{formatMsToHrMin(breakMs)}</span>
            
            {/* Micro Progress Line */}
            <div style={{ height: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 1, overflow: 'hidden', width: '100%' }}>
              <div style={{ height: '100%', background: breakAlert.gradient, width: `${Math.min((breakMs / (75 * 60 * 1000)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* ROW 1 RIGHT: BRB Time */}
        <div 
          className="telemetry-card"
          style={{
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            height: 68,
            overflow: 'hidden',
          }}
        >
          {/* Pulsing Status Bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: brbAlert.color,
            boxShadow: `0 0 8px ${brbAlert.color}`,
            animation: isOnBrb ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Hourglass size={10} style={{ color: brbAlert.color }} />
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontFamily: "'Satoshi', sans-serif" }}>BRB TIME</span>
            </div>
            {isOnBrb && <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: brbAlert.color, boxShadow: `0 0 6px ${brbAlert.color}` }} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "'Satoshi', sans-serif",
              color: brbAlert.level === 'safe' ? '#fff' : brbAlert.color,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>{formatMsToHrMin(brbMs)}</span>
            
            {/* Micro Progress Line */}
            <div style={{ height: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 1, overflow: 'hidden', width: '100%' }}>
              <div style={{ height: '100%', background: brbAlert.gradient, width: `${Math.min((brbMs / (15 * 60 * 1000)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* ROW 2 LEFT: Work Time */}
        <div 
          className="telemetry-card"
          style={{
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            height: 68,
            overflow: 'hidden',
          }}
        >
          {/* Pulsing Status Bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: isWorking ? '#00F5A0' : 'rgba(255,255,255,0.08)',
            boxShadow: isWorking ? '0 0 8px #00F5A0' : 'none',
            animation: isWorking ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={10} style={{ color: isWorking ? '#00F5A0' : 'rgba(255,255,255,0.22)' }} />
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontFamily: "'Satoshi', sans-serif" }}>WORK TIME</span>
            </div>
            {isWorking && <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#00F5A0', boxShadow: '0 0 6px #00F5A0' }} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "'Satoshi', sans-serif",
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>{formatMsToHrMin(workedMs)}</span>
            
            {/* Micro Progress Line */}
            <div style={{ height: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 1, overflow: 'hidden', width: '100%' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #00F5A0 0%, #00D9F5 100%)', width: `${Math.min((workedMs / (8.5 * 3600000)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* ROW 2 RIGHT: Total Break */}
        <div 
          className="telemetry-card"
          style={{
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            height: 68,
            overflow: 'hidden',
          }}
        >
          {/* Pulsing Status Bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: combinedAlert.color === 'rgba(255,255,255,0.25)' ? 'rgba(255,255,255,0.1)' : combinedAlert.color,
            boxShadow: combinedAlert.level !== 'safe' ? `0 0 8px ${combinedAlert.color}` : 'none',
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldAlert size={10} style={{ color: combinedAlert.color === 'rgba(255,255,255,0.25)' ? '#fff' : combinedAlert.color, opacity: combinedAlert.color === 'rgba(255,255,255,0.25)' ? 0.6 : 1 }} />
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontFamily: "'Satoshi', sans-serif" }}>TOTAL BREAK</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "'Satoshi', sans-serif",
              color: combinedAlert.level === 'safe' ? '#fff' : combinedAlert.color,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>{formatMsToHrMin(totalBreak)}</span>
            
            {/* Micro Progress Line */}
            <div style={{ height: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 1, overflow: 'hidden', width: '100%' }}>
              <div style={{ height: '100%', background: combinedAlert.gradient, width: `${Math.min((totalBreak / (85 * 60 * 1000)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

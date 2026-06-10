'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '@/types';
import { formatMs } from '@/lib/timeUtils';

interface HeroClusterProps {
  now: number; user: User; status: string;
  workedMs: number; breakMs: number; brbMs: number;
}

const STATUS: Record<string, { label: string; color: string }> = {
  working:     { label: 'Working',  color: '#00F5A0' },
  on_break:    { label: 'On Break', color: '#FBBF24' },
  on_brb:      { label: 'BRB',      color: '#A78BFA' },
  punched_out: { label: 'Done',     color: '#6B7280' },
  idle:        { label: 'Idle',     color: '#FF2D55' },
};

/* ── Premium stat card — horizontal layout, larger values ── */
function StatCard({ label, value, color, pct, live }: {
  label: string; value: string; color: string; pct: number; live?: boolean;
}) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 16,
      flex: 1,
      background: live
        ? `linear-gradient(145deg, ${color}1e 0%, ${color}08 100%)`
        : 'linear-gradient(145deg, rgba(255,255,255,0.035) 0%, rgba(0,0,0,0.18) 100%)',
      border: `1px solid ${live ? color + '40' : 'rgba(255,255,255,0.07)'}`,
      padding: '16px 18px 14px',
      boxShadow: live
        ? `0 0 44px ${color}14, 0 0 80px ${color}06, inset 0 0 28px ${color}06`
        : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      transition: 'all 0.55s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
        background: live
          ? `linear-gradient(90deg, transparent, ${color}95 40%, ${color} 50%, ${color}95 60%, transparent)`
          : `linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 50%, transparent)`,
        transition: 'background 0.55s ease',
      }} />

      {/* Corner glow — live only */}
      {live && (
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 90, height: 90,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}2a 0%, transparent 70%)`,
          filter: 'blur(16px)', pointerEvents: 'none',
        }} />
      )}

      {/* Label + LIVE badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: live ? `${color}e5` : 'rgba(255,255,255,0.35)',
          fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
          transition: 'color 0.55s ease',
        }}>{label}</span>
        {live && (
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: color, background: `${color}1a`, border: `1px solid ${color}38`,
            padding: '2px 8px', borderRadius: 6,
            fontFamily: "'Satoshi', system-ui, sans-serif",
            animation: 'statusPulse 2s ease-in-out infinite',
          }}>LIVE</span>
        )}
      </div>

      {/* Value — larger, bolder */}
      <div style={{
        fontSize: 28, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1,
        color: live ? '#ffffff' : 'rgba(255,255,255,0.82)',
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontVariantNumeric: 'tabular-nums',
        textShadow: live ? `0 0 36px ${color}45` : 'none',
        marginBottom: 14,
        transition: 'color 0.55s ease, text-shadow 0.55s ease',
      }}>{value}</div>

      {/* Progress bar — 3px for more presence */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${color}55, ${color})`,
            borderRadius: 3,
            boxShadow: live ? `0 0 12px ${color}75` : 'none',
          }}
        />
      </div>
    </div>
  );
}

export default function HeroCluster({ now, user, status, workedMs, breakMs, brbMs }: HeroClusterProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const s = STATUS[status] || STATUS.idle;
  const totalBreak = breakMs + brbMs;

  /* Live time + date in user's timezone */
  const t = useMemo(() => {
    if (!mounted) return { hh: '00', mm: '00', ss: '00', amPm: 'AM', weekday: '', day: '', month: '' };
    try {
      const tz = user?.timezone || 'America/Chicago';
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      }).formatToParts(new Date(now));
      const g = (k: string) => parts.find(p => p.type === k)?.value || '00';
      const dParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'long', month: 'short', day: 'numeric',
      }).formatToParts(new Date(now));
      const dg = (k: string) => dParts.find(p => p.type === k)?.value || '';
      return {
        hh: g('hour'), mm: g('minute'), ss: g('second'),
        amPm: parts.find(p => p.type === 'dayPeriod')?.value.toUpperCase() || 'AM',
        weekday: dg('weekday'), day: dg('day'), month: dg('month').toUpperCase(),
      };
    } catch {
      const d = new Date(now), h = d.getHours();
      const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
      return {
        hh: String(h % 12 || 12).padStart(2, '0'), mm: String(d.getMinutes()).padStart(2, '0'),
        ss: String(d.getSeconds()).padStart(2, '0'), amPm: h >= 12 ? 'PM' : 'AM',
        weekday: wd, day: String(d.getDate()), month: mo,
      };
    }
  }, [now, user?.timezone, mounted]);

  /* ── Ring geometry ── */
  const CX = 122, CY = 122;
  const R_WORKED  = 105;   // outer  — shift progress
  const R_BREAK   = 87;    // middle — break budget used
  const R_SECONDS = 69;    // inner  — live seconds

  const workedPct = Math.min(workedMs / (8.5 * 3600000), 1);
  const breakPct  = Math.min(totalBreak / (85 * 60000), 1);
  const secPct    = parseInt(t.ss || '0') / 60;

  const circ = (r: number) => 2 * Math.PI * r;
  const ang  = (pct: number, r: number) => ({ x: CX + r * Math.cos((pct * 360 - 90) * Math.PI / 180), y: CY + r * Math.sin((pct * 360 - 90) * Math.PI / 180) });

  const wTip = ang(workedPct, R_WORKED);
  const sTip = ang(secPct, R_SECONDS);

  return (
    <motion.div
      layout
      style={{
        background: 'linear-gradient(160deg, #0e0d14 0%, #09090e 55%, #060608 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        display: 'flex', flexDirection: 'row',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 28px 80px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* ── Breathing depth glow (status-reactive) ── */}
      <motion.div
        key={`glow-${status}`}
        animate={{ opacity: [0.45, 0.70, 0.45], scale: [1, 1.06, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '-38%', left: '-8%',
          width: 400, height: 400, borderRadius: '50%',
          background: `radial-gradient(circle, ${s.color}16 0%, transparent 65%)`,
          filter: 'blur(55px)', pointerEvents: 'none',
          transition: 'background 0.8s ease',
        }}
      />

      {/* ════════════════════════════════════
          CLOCK PANEL
          ════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, minWidth: 286,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '22px 26px', gap: 0,
        position: 'relative', zIndex: 1,
        borderRight: '1px solid rgba(255,255,255,0.055)',
      }}>

        {/* Clock face — 244×244 SVG */}
        <div style={{ position: 'relative', width: 244, height: 244 }}>
          <svg width="244" height="244" viewBox="0 0 244 244" fill="none"
            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>

            {/* ── RING 1: Worked progress (outer, dominant) ── */}
            <circle cx={CX} cy={CY} r={R_WORKED}
              stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle cx={CX} cy={CY} r={R_WORKED}
              stroke={s.color} strokeWidth="4" strokeLinecap="round"
              fill="none" transform={`rotate(-90 ${CX} ${CY})`}
              strokeDasharray={`${workedPct * circ(R_WORKED)} ${circ(R_WORKED)}`}
              style={{ filter: `drop-shadow(0 0 7px ${s.color}90)`, transition: 'stroke-dasharray 1.2s ease-out, stroke 0.7s ease' }}
            />
            {/* Worked tip dot */}
            <circle cx={wTip.x} cy={wTip.y} r="4.5"
              fill={s.color} stroke="rgba(0,0,0,0.5)" strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 8px ${s.color})`, transition: 'all 1.2s ease-out' }} />

            {/* ── RING 2: Break budget (middle, amber) ── */}
            <circle cx={CX} cy={CY} r={R_BREAK}
              stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
            <circle cx={CX} cy={CY} r={R_BREAK}
              stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"
              fill="none" transform={`rotate(-90 ${CX} ${CY})`}
              strokeDasharray={`${breakPct * circ(R_BREAK)} ${circ(R_BREAK)}`}
              style={{ filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.75))', transition: 'stroke-dasharray 1.2s ease-out' }}
            />

            {/* ── RING 3: Seconds (inner, faint, ticking) ── */}
            <circle cx={CX} cy={CY} r={R_SECONDS}
              stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r={R_SECONDS}
              stroke={`${s.color}38`} strokeWidth="1.5" strokeLinecap="round"
              fill="none" transform={`rotate(-90 ${CX} ${CY})`}
              strokeDasharray={`${secPct * circ(R_SECONDS)} ${circ(R_SECONDS)}`}
              style={{ transition: 'stroke-dasharray 0.95s linear' }}
            />
            {/* Seconds tip */}
            <circle cx={sTip.x} cy={sTip.y} r="2.5"
              fill={`${s.color}cc`}
              style={{ filter: `drop-shadow(0 0 5px ${s.color}80)` }} />

            {/* Center radial glow */}
            <circle cx={CX} cy={CY} r="55" fill={`${s.color}07`} style={{ transition: 'fill 0.8s' }} />
            <circle cx={CX} cy={CY} r="30" fill={`${s.color}05`} style={{ transition: 'fill 0.8s' }} />

          </svg>

          {/* ── TIME — centered inside rings ── */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* H : M */}
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <AnimatePresence mode="popLayout">
                <motion.span key={`hh-${t.hh}`}
                  initial={{ y: -9, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 580, damping: 30, mass: 0.7 }}
                  style={{
                    fontSize: 50, fontWeight: 600, color: '#fff', lineHeight: 1,
                    fontFamily: "'Geist Mono', ui-monospace, monospace",
                    letterSpacing: '-0.055em', fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 50px ${s.color}30`,
                  }}
                >{t.hh}</motion.span>
              </AnimatePresence>
              <span style={{
                fontSize: 38, fontWeight: 200, lineHeight: 1, padding: '0 2px',
                color: 'rgba(255,255,255,0.22)',
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                animation: 'timerFade 1s ease-in-out infinite',
              }}>:</span>
              <AnimatePresence mode="popLayout">
                <motion.span key={`mm-${t.mm}`}
                  initial={{ y: -9, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 580, damping: 30, mass: 0.7 }}
                  style={{
                    fontSize: 50, fontWeight: 600, color: '#fff', lineHeight: 1,
                    fontFamily: "'Geist Mono', ui-monospace, monospace",
                    letterSpacing: '-0.055em', fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 50px ${s.color}30`,
                  }}
                >{t.mm}</motion.span>
              </AnimatePresence>
            </div>

            {/* Date + AM/PM */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.40)',
                fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
              }}>{t.weekday?.slice(0, 3)} · {t.month} {t.day}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                color: `${s.color}c0`,
                fontFamily: "'Satoshi', system-ui, sans-serif",
                transition: 'color 0.6s ease',
              }}>{t.amPm}</span>
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div key={`pill-${status}`} style={{
          marginTop: 14,
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 16px', borderRadius: 100,
          background: `${s.color}0f`, border: `1px solid ${s.color}32`,
          boxShadow: `0 0 20px ${s.color}0a`,
          animation: 'status-pill-enter 0.45s cubic-bezier(0.16,1,0.3,1)',
          transition: 'background 0.6s ease, border-color 0.6s ease',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: s.color,
            boxShadow: `0 0 8px ${s.color}`,
            animation: (status !== 'idle' && status !== 'punched_out') ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
            color: s.color, fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
          }}>{s.label}</span>
        </div>

        {/* Ring legend — decodes the 3 rings */}
        <div style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: s.color, boxShadow: `0 0 5px ${s.color}80`, transition: 'background 0.6s' }} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontFamily: "'Satoshi', sans-serif" }}>shift</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 2, borderRadius: 2, background: '#FBBF24', boxShadow: '0 0 5px rgba(251,191,36,0.6)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontFamily: "'Satoshi', sans-serif" }}>breaks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 1, borderRadius: 2, background: `${s.color}55`, transition: 'background 0.6s' }} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontFamily: "'Satoshi', sans-serif" }}>sec</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          STAT CARDS — 4-column horizontal row
          ════════════════════════════════════ */}
      <div style={{
        flex: 1, padding: '14px 16px 14px 10px',
        display: 'flex', alignItems: 'stretch',
        position: 'relative', zIndex: 1, minWidth: 0,
      }}>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <StatCard
            label="Worked"   value={formatMs(workedMs)}
            color="#00F5A0"  pct={(workedMs / (8.5 * 3600000)) * 100}
            live={status === 'working'} />
          <StatCard
            label="Break"    value={formatMs(breakMs)}
            color="#FBBF24"  pct={(breakMs / (75 * 60000)) * 100}
            live={status === 'on_break'} />
          <StatCard
            label="BRB"      value={formatMs(brbMs)}
            color="#A78BFA"  pct={(brbMs / (10 * 60000)) * 100}
            live={status === 'on_brb'} />
          <StatCard
            label="Combined" value={formatMs(totalBreak)}
            color="#60A5FA"  pct={(totalBreak / (85 * 60000)) * 100} />
        </div>
      </div>
    </motion.div>
  );
}

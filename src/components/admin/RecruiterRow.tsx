'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDuration, getRealNow } from '@/lib/timeUtils';
import type { UserStatusRecord } from '@/lib/store';
import { Pencil, LogOut, TrendingUp, User as UserIcon, Play, Square } from 'lucide-react';
import { getClientTheme } from '@/lib/utils';

interface RecruiterRowProps {
  record: UserStatusRecord;
  isOnLeave?: boolean;
  onEndBreak?: (userId: string) => void;
  onEndBrb?: (userId: string) => void;
  onPunchOut?: (userId: string) => void;
  onEditLogs?: (userId: string, userName: string, clientName: string) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── SHARED GRID ────────────────────────────────────────────────────────────
// IMPORTANT: header in LiveFloor.tsx MUST use this exact same string
export const ROW_GRID = 'grid-cols-[48px_1fr_100px_96px_80px_64px_80px_112px]';
export const ROW_GAP  = 'gap-x-4';
export const ROW_PX   = 'px-5';

export default function RecruiterRow({
  record,
  isOnLeave,
  onEndBreak,
  onEndBrb,
  onPunchOut,
  onEditLogs,
}: RecruiterRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const {
    user,
    status: rawStatus,
    workedMs,
    breakMs,
    brbMs,
    punchIn,
    workStart,
    breakStart,
    brbStart,
    breakCount,
    brbCount,
  } = record;

  const status    = isOnLeave ? ('on_leave' as const) : rawStatus;
  const isActive  = status === 'working' || status === 'on_break' || status === 'on_brb';
  const isWorking = status === 'working';

  const [now, setNow] = useState(getRealNow());

  // Sync on record change
  useEffect(() => { setNow(getRealNow()); }, [record]);

  // Live 1-second tick when active
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(getRealNow()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const clientTheme = getClientTheme(user.clientName);

  // ── Accumulated break / BRB durations ─────────────────────────────────────
  const currentBreak =
    status === 'on_break' && breakStart
      ? (record.accumulatedBreakMs ?? breakMs ?? 0) + (now - breakStart)
      : breakMs ?? 0;

  const currentBrb =
    status === 'on_brb' && brbStart
      ? (record.accumulatedBrbMs ?? brbMs ?? 0) + (now - brbStart)
      : brbMs ?? 0;

  const currentTotalBreak = currentBreak + currentBrb;

  // ── Total worked = elapsed − all breaks (frozen during break) ─────────────
  const currentWorked = isActive
    ? punchIn
      ? Math.max(0, now - punchIn - currentTotalBreak)
      : workedMs ?? 0
    : workedMs ?? 0;

  // ── SHIFT COLUMN — dynamic context timer ──────────────────────────────────
  // • On break  → how long THIS break has been running  (amber, ticking)
  // • On BRB    → how long THIS BRB has been running    (blue, ticking)
  // • Working   → total worked time                     (green, ticking)
  // • Else      → total worked time                     (dim)
  const shiftDisplayMs: number = (() => {
    if (status === 'on_break' && breakStart) return now - breakStart;
    if (status === 'on_brb'   && brbStart)   return now - brbStart;
    return currentWorked;
  })();

  const shiftIsLive = isActive;

  // ── Unified Palette ───────────────────────────────────────────────────────
  const COLOR_WORKING = '#10b981';
  const COLOR_BREAK   = '#f59e0b';
  const COLOR_BRB     = '#3b82f6';
  const COLOR_LEAVE   = '#8b5cf6';
  const COLOR_MUTED   = '#94a3b8';
  const COLOR_EMPTY   = 'rgba(255, 255, 255, 0.18)';
  const COLOR_TOTAL   = '#e2e8f0';

  // ── Accent color for avatar spinner and borders ───────────────────────────
  let accentColor = '#334155';
  if (status === 'working')  accentColor = COLOR_WORKING;
  if (status === 'on_break') accentColor = COLOR_BREAK;
  if (status === 'on_brb')   accentColor = COLOR_BRB;
  if (status === 'on_leave') accentColor = COLOR_LEAVE;

  // ── SHIFT timer display color ─────────────────────────────────────────────
  let shiftColor = '#475569';
  let shiftGlow  = 'none';

  if (status === 'on_break' && breakStart) {
    shiftColor = COLOR_BREAK;
    shiftGlow  = `0 0 8px ${COLOR_BREAK}50`;
  } else if (status === 'on_brb' && brbStart) {
    shiftColor = COLOR_BRB;
    shiftGlow  = `0 0 8px ${COLOR_BRB}50`;
  } else if (punchIn) {
    if (isWorking) {
      shiftColor = COLOR_WORKING;
      shiftGlow  = `0 0 10px ${COLOR_WORKING}40`;
    } else {
      shiftColor = COLOR_MUTED;
    }
  }

  // ── Individual Column colors (unified for break and brb) ───────────────────
  const breakColor = currentBreak > 0 ? COLOR_BREAK : COLOR_EMPTY;
  const breakGlow  = status === 'on_break' && currentBreak > 0 ? `0 0 8px ${COLOR_BREAK}50` : 'none';

  const brbColor   = currentBrb > 0 ? COLOR_BRB : COLOR_EMPTY;
  const brbGlow    = status === 'on_brb' && currentBrb > 0 ? `0 0 8px ${COLOR_BRB}50` : 'none';

  const totalColor = currentTotalBreak > 0 ? COLOR_TOTAL : 'rgba(255, 255, 255, 0.14)';
  const totalGlow  = 'none';

  const totalMin = currentTotalBreak / 60000;
  const shiftLimitMs = 9 * 60 * 60 * 1000;
  const shiftPct = Math.min(100, Math.max(0, (currentWorked / shiftLimitMs) * 100));

  // ── Blinking colon ────────────────────────────────────────────────────────
  const colonVisible = Math.floor(now / 1000) % 2 === 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toHM(ms: number) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    return {
      h: String(Math.floor(mins / 60)).padStart(2, '0'),
      m: String(mins % 60).padStart(2, '0'),
    };
  }

  function Clock({
    ms,
    live,
    color,
    glow,
  }: {
    ms: number;
    live: boolean;
    color: string;
    glow: string;
  }) {
    const { h, m } = toHM(ms);
    const fontSize = 'text-[13px]';
    return (
      <div className="relative flex items-center justify-center w-full">
        {/* Ghost digits for stability */}
        <span
          className={`absolute ${fontSize} font-bold font-mono tracking-tight leading-none pointer-events-none select-none opacity-[0.035]`}
          style={{ color }}
        >
          88:88
        </span>
        <span
          className={`relative ${fontSize} font-bold font-mono tracking-tight leading-none flex items-center`}
          style={{ color, textShadow: glow }}
        >
          {h}
          <span
            className="mx-[1px] transition-opacity duration-150"
            style={{ opacity: live && colonVisible ? 0.25 : 1 }}
          >
            :
          </span>
          {m}
        </span>
      </div>
    );
  }

  // ── Protocol badge ─────────────────────────────────────────────────────────
  // Single-line only — no stacking
  function ProtocolBadge() {
    if (status === 'working')  return <span className="badge badge-working  text-[9px] py-1 px-3 whitespace-nowrap">WORKING</span>;
    if (status === 'on_break') return <span className="badge badge-break    text-[9px] py-1 px-3 whitespace-nowrap">BREAK</span>;
    if (status === 'on_brb')   return <span className="badge badge-brb      text-[9px] py-1 px-3 whitespace-nowrap">BRB</span>;
    if (status === 'on_leave') return <span className="badge badge-leave    text-[9px] py-1 px-3 whitespace-nowrap">LEAVE</span>;
    return (
      <span className="text-[8px] font-black font-mono tracking-[0.18em] text-slate-600 uppercase">
        {punchIn ? 'DONE' : 'OFFLINE'}
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // ─ EXACT same grid / gap / px as the header in LiveFloor ─
      className={`relative grid ${ROW_GRID} ${ROW_GAP} ${ROW_PX} items-center
        py-3.5 rounded-2xl group border transition-all duration-300
        ${isActive
          ? 'bg-gradient-to-r from-white/[0.025] to-white/[0.006] shadow-[0_6px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm'
          : 'bg-white/[0.008] hover:bg-white/[0.018]'
        }`}
      style={{
        borderColor: isActive
          ? isHovered ? `${accentColor}70` : `${accentColor}35`
          : isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Left accent bar */}
      {isActive && (
        <div
          className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
        />
      )}

      {/* ── 1. Avatar HUD ──────────────────────────────────────────────────── */}
      <div className="relative w-12 h-12 flex items-center justify-center select-none flex-shrink-0">
        {/* CW spinner ring */}
        <div
          className="absolute inset-0 rounded-[30%] border border-dashed opacity-[0.18] hud-spinner-cw pointer-events-none"
          style={{ borderColor: accentColor }}
        />
        {/* CCW ring */}
        <div
          className="absolute inset-[3px] rounded-[30%] border border-dotted opacity-[0.22] hud-spinner-ccw pointer-events-none"
          style={{ borderColor: accentColor }}
        />
        {/* Breathing halo (active only) */}
        {isActive && (
          <div
            className="absolute inset-[6px] rounded-[30%] hud-breath pointer-events-none"
            style={{
              backgroundColor: `${accentColor}12`,
              border: `1px solid ${accentColor}50`,
              boxShadow: `0 0 10px ${accentColor}80`,
              color: accentColor,
            }}
          />
        )}
        {/* Shift-completion progress arc */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox="0 0 48 48"
        >
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.5"
            strokeDasharray={2 * Math.PI * 20}
            strokeDashoffset={2 * Math.PI * 20 * (1 - shiftPct / 100)}
            strokeLinecap="round"
            style={{
              opacity: isActive ? 0.65 : 0.12,
              filter: isActive ? `drop-shadow(0 0 3px ${accentColor})` : 'none',
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </svg>
        {/* Initials */}
        <div
          className="relative w-[30px] h-[30px] rounded-[28%] flex items-center justify-center"
          style={{
            background: isActive
              ? `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}06 100%)`
              : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isActive ? `${accentColor}35` : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          <span
            className="text-[9px] font-black tracking-tight"
            style={{
              color: isActive ? '#ffffff' : '#475569',
              textShadow: isActive ? `0 0 6px ${accentColor}70` : 'none',
            }}
          >
            {getInitials(user.name)}
          </span>
        </div>
      </div>

      {/* ── 2. Identity (Name + Client) ────────────────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 gap-[3px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[13px] font-bold text-white tracking-tight truncate leading-tight"
            title={user.name}
          >
            {user.name}
          </span>
          {breakCount === 0 && brbCount === 0 && punchIn && (
            <span className="flex-shrink-0 flex items-center gap-0.5 px-1 py-[1px] rounded border border-amber-500/20 bg-amber-500/8">
              <TrendingUp size={7} className="text-amber-400" />
              <span className="text-[6px] font-black text-amber-400 uppercase tracking-widest">Elite</span>
            </span>
          )}
        </div>
        <span
          className="text-[8px] font-bold uppercase tracking-[0.18em] flex items-center gap-[3px] truncate leading-tight"
          style={{ color: clientTheme.color }}
        >
          <UserIcon size={7} className="flex-shrink-0" />
          {user.clientName}
        </span>
      </div>

      {/* ── 3. Protocol — badge only, single line ──────────────────────────── */}
      <div className="flex items-center justify-center">
        <ProtocolBadge />
      </div>

      {/* ── 4. Shift — DYNAMIC context timer ──────────────────────────────── */}
      {/*    On break → break duration (ticking amber)                          */}
      {/*    On BRB   → BRB duration   (ticking blue)                          */}
      {/*    Working  → total worked    (ticking green)                         */}
      <div className="relative flex items-center justify-center">
        <div className="absolute left-[-8px] top-[15%] bottom-[15%] w-[1px] bg-gradient-to-b from-transparent via-white/[0.06] to-transparent pointer-events-none" />
        <Clock ms={shiftDisplayMs} live={shiftIsLive} color={shiftColor} glow={shiftGlow} />
      </div>

      {/* ── 5. Break total ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center">
        <Clock ms={currentBreak} live={status === 'on_break'} color={breakColor} glow={breakGlow} />
      </div>

      {/* ── 6. BRB total ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center">
        <Clock ms={currentBrb} live={status === 'on_brb'} color={brbColor} glow={brbGlow} />
      </div>

      {/* ── 7. Total break ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center gap-[3px]">
        <Clock ms={currentTotalBreak} live={status === 'on_break' || status === 'on_brb'} color={totalColor} glow={totalGlow} />
        {currentTotalBreak > 0 && (
          <div className="h-[2px] w-8 rounded-full overflow-hidden bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min((totalMin / 85) * 100, 100)}%`,
                background: totalColor,
              }}
            />
          </div>
        )}
      </div>

      {/* ── 8. Actions ─────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center gap-2">
        <div className="absolute left-[-8px] top-[15%] bottom-[15%] w-[1px] bg-gradient-to-b from-transparent via-white/[0.06] to-transparent pointer-events-none" />

        {/* Resume from break */}
        {status === 'on_break' && onEndBreak && (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onEndBreak(user.id)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.08em] py-[7px] px-3 rounded-xl cursor-pointer whitespace-nowrap"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: `1px solid rgba(245, 158, 11, 0.35)`,
              color: COLOR_BREAK,
              boxShadow: '0 2px 12px rgba(245, 158, 11, 0.15)',
              textShadow: '0 0 6px rgba(245, 158, 11, 0.6)',
            }}
          >
            <Play size={8} className="fill-current flex-shrink-0" />
            Resume
          </motion.button>
        )}

        {/* End BRB */}
        {status === 'on_brb' && onEndBrb && (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onEndBrb(user.id)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.08em] py-[7px] px-3 rounded-xl cursor-pointer whitespace-nowrap"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: `1px solid rgba(59, 130, 246, 0.35)`,
              color: COLOR_BRB,
              boxShadow: '0 2px 12px rgba(59, 130, 246, 0.15)',
              textShadow: '0 0 6px rgba(59, 130, 246, 0.6)',
            }}
          >
            <Square size={8} className="fill-current flex-shrink-0" />
            End BRB
          </motion.button>
        )}

        {/* Offline placeholder */}
        {!isActive && !punchIn && (
          <span className="text-[7px] font-black font-mono tracking-[0.2em] text-slate-700 uppercase">
            —
          </span>
        )}

        {/* Hover-reveal: punch out + edit */}
        <div
          className={`flex items-center gap-1 transition-all duration-200 ${
            isActive
              ? 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
              : 'opacity-100'
          }`}
        >
          {status === 'working' && onPunchOut && (
            <button
              onClick={() => onPunchOut(user.id)}
              title="Punch out"
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
            >
              <LogOut size={12} />
            </button>
          )}
          {onEditLogs && punchIn && (
            <button
              onClick={() => onEditLogs(user.id, user.name, user.clientName)}
              title="Edit logs"
              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDuration, getRealNow } from '@/lib/timeUtils';
import type { UserStatusRecord } from '@/lib/store';
import { Pencil, LogOut, TrendingUp, User as UserIcon, Play, Coffee, Timer } from 'lucide-react';
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
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/* HH:MM but drop leading "00:" for compactness */
function fmtShort(ms: number) {
  const d = formatDuration(ms);
  return d.startsWith('00:') ? d.slice(3) : d;
}

export default function RecruiterRow({ record, isOnLeave, onEndBreak, onEndBrb, onPunchOut, onEditLogs }: RecruiterRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { user, status: rawStatus, workedMs, breakMs, brbMs, punchIn, workStart, breakStart, brbStart, breakCount, brbCount } = record;
  const status = isOnLeave ? ('on_leave' as const) : rawStatus;
  const isActive = status === 'working' || status === 'on_break' || status === 'on_brb';
  const isWorking = status === 'working';
  
  const [now, setNow] = useState(getRealNow());

  useEffect(() => {
    setNow(getRealNow());
  }, [record]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setNow(getRealNow());
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const clientTheme = getClientTheme(user.clientName);

  // ── Break / BRB live durations ──────────────────────────────────────────────
  const currentBreak = (status === 'on_break' && breakStart)
    ? ((record.accumulatedBreakMs !== undefined ? record.accumulatedBreakMs : breakMs) + (now - breakStart))
    : (breakMs || 0);

  const currentBrb = (status === 'on_brb' && brbStart)
    ? ((record.accumulatedBrbMs !== undefined ? record.accumulatedBrbMs : brbMs) + (now - brbStart))
    : (brbMs || 0);

  const currentTotalBreak = currentBreak + currentBrb;

  // ── Shift = total elapsed since punch-in MINUS all break/BRB time ─────────
  // Frozen while on break (because currentTotalBreak is growing at the same rate as now)
  // Resumes ticking when back to working
  const currentWorked = isActive
    ? (punchIn ? Math.max(0, now - punchIn - currentTotalBreak) : workedMs)
    : workedMs;

  // ── Protocol column: time since CURRENT status started ────────────────────
  // This shows how long they've been in the current state (break, BRB, or work session)
  const statusSinceMs = (() => {
    if (status === 'on_break' && breakStart) return now - breakStart;
    if (status === 'on_brb' && brbStart) return now - brbStart;
    if (status === 'working' && workStart) return now - workStart;
    return 0;
  })();
  const statusSinceTicking = status === 'on_break' || status === 'on_brb' || status === 'working';

  const shiftLimitMs = 9 * 60 * 60 * 1000;
  const shiftPct = Math.min(100, Math.max(0, (currentWorked / shiftLimitMs) * 100));

  // ── Accent / status colors ────────────────────────────────────────────────
  let accentColor = '#64748b';
  if (status === 'working') accentColor = '#00F5A0';
  else if (status === 'on_break') accentColor = '#FBBF24';
  else if (status === 'on_brb') accentColor = '#3b82f6';
  else if (status === 'on_leave') accentColor = '#8b5cf6';

  // ── Telemetry column colors ───────────────────────────────────────────────
  const shiftMin = currentWorked / 60000;
  const breakMin = currentBreak / 60000;
  const brbMin = currentBrb / 60000;
  const totalMin = currentTotalBreak / 60000;

  // Shift color
  let shiftColor = '#475569';
  let shiftGlow = 'none';
  if (punchIn) {
    if (shiftMin > 540) {
      shiftColor = '#ef4444'; shiftGlow = '0 0 12px #ef4444, 0 0 4px #ef4444';
    } else if (shiftMin > 510) {
      shiftColor = '#f59e0b'; shiftGlow = '0 0 8px #f59e0b';
    } else if (isWorking) {
      shiftColor = '#00F5A0'; shiftGlow = '0 0 10px rgba(0,245,160,0.4)';
    } else if (status === 'on_break') {
      shiftColor = '#f59e0b'; shiftGlow = '0 0 6px rgba(245,158,11,0.2)';
    } else if (status === 'on_brb') {
      shiftColor = '#60a5fa'; shiftGlow = '0 0 6px rgba(96,165,250,0.2)';
    } else {
      shiftColor = '#cbd5e1';
    }
  }

  // Break color
  let breakColor = 'rgba(255,255,255,0.18)';
  let breakGlow = 'none';
  if (breakMin > 0) {
    if (breakMin > 75) { breakColor = '#ef4444'; breakGlow = '0 0 12px #ef4444, 0 0 4px #ef4444'; }
    else if (breakMin > 60) { breakColor = '#f59e0b'; breakGlow = '0 0 8px #f59e0b'; }
    else { breakColor = '#f59e0b'; if (status === 'on_break') breakGlow = '0 0 8px rgba(245,158,11,0.4)'; }
  }

  // BRB color
  let brbColor = 'rgba(255,255,255,0.18)';
  let brbGlow = 'none';
  if (brbMin > 0) {
    if (brbMin > 10) { brbColor = '#ef4444'; brbGlow = '0 0 12px #ef4444, 0 0 4px #ef4444'; }
    else if (brbMin > 8) { brbColor = '#f59e0b'; brbGlow = '0 0 8px #f59e0b'; }
    else { brbColor = '#3b82f6'; if (status === 'on_brb') brbGlow = '0 0 8px rgba(59,130,246,0.4)'; }
  }

  // Total break color
  let totalColor = 'rgba(255,255,255,0.18)';
  let totalGlow = 'none';
  if (currentTotalBreak > 0) {
    if (totalMin > 85) { totalColor = '#ef4444'; totalGlow = '0 0 12px #ef4444, 0 0 4px #ef4444'; }
    else if (totalMin > 70) { totalColor = '#f59e0b'; totalGlow = '0 0 8px #f59e0b'; }
    else { totalColor = '#94a3b8'; }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatHrMin(ms: number) {
    const totalMins = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return {
      h: String(h).padStart(2, '0'),
      m: String(m).padStart(2, '0'),
    };
  }

  // Blink colon every second when timer is live
  const flash = Math.floor(now / 1000) % 2 === 0;

  // Render a HH:MM digital timer cell
  const renderTime = (ms: number, isTimerActive: boolean, color: string, glow: string) => {
    const { h, m } = formatHrMin(ms);
    return (
      <div className="relative flex items-center justify-center min-w-0">
        {/* Ghost digits for alignment */}
        <span className="absolute text-[14px] font-black font-mono tracking-tight leading-none pointer-events-none select-none opacity-[0.04]" style={{ color }}>88:88</span>
        <span className="relative text-[14px] font-black font-mono tracking-tight leading-none z-10 flex items-center" style={{ color, textShadow: glow }}>
          <span>{h}</span>
          <span className="transition-opacity duration-300 mx-[0.5px] font-sans" style={{ opacity: (isTimerActive && !flash) ? 0.3 : 1 }}>:</span>
          <span>{m}</span>
        </span>
      </div>
    );
  };

  // Render the Protocol column — badge + live "time in current status" timer
  const renderProtocol = () => {
    const { h: sh, m: sm } = formatHrMin(statusSinceMs);
    const timerStr = `${sh}:${sm}`;
    const colonOpacity = statusSinceTicking && !flash ? 0.3 : 1;

    if (status === 'on_break') {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="badge badge-break py-0.5 px-2.5 text-[9px]">BREAK</div>
          <div className="flex items-center gap-0.5 font-mono text-[13px] font-black" style={{ color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
            <span>{sh}</span>
            <span style={{ opacity: colonOpacity }}>:</span>
            <span>{sm}</span>
          </div>
        </div>
      );
    }
    if (status === 'on_brb') {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="badge badge-brb py-0.5 px-2.5 text-[9px]">BRB</div>
          <div className="flex items-center gap-0.5 font-mono text-[13px] font-black" style={{ color: '#60a5fa', textShadow: '0 0 8px rgba(96,165,250,0.5)' }}>
            <span>{sh}</span>
            <span style={{ opacity: colonOpacity }}>:</span>
            <span>{sm}</span>
          </div>
        </div>
      );
    }
    if (status === 'working') {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="badge badge-working py-0.5 px-2.5 text-[9px]">WORKING</div>
          {statusSinceMs > 0 && (
            <div className="flex items-center gap-0.5 font-mono text-[11px] font-black opacity-60" style={{ color: '#00F5A0' }}>
              <span>{sh}</span>
              <span style={{ opacity: colonOpacity }}>:</span>
              <span>{sm}</span>
            </div>
          )}
        </div>
      );
    }
    if (status === 'on_leave') {
      return <div className="badge badge-leave py-0.5 px-2.5 text-[9px] text-center">LEAVE</div>;
    }
    // Offline / punched out
    return (
      <div className="text-[9px] font-black tracking-widest text-slate-600 uppercase font-mono">
        {punchIn ? 'DONE' : 'OFFLINE'}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative grid grid-cols-[44px_1fr_90px_78px_78px_62px_85px_106px] items-center gap-3 px-4 py-2 rounded-2xl group transition-all duration-300 ${
        isActive
          ? 'bg-gradient-to-r from-white/[0.025] to-white/[0.005] shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md'
          : 'bg-white/[0.008] hover:bg-white/[0.02] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]'
      } border`}
      style={{
        borderColor: isActive
          ? isHovered ? `${accentColor}50` : `${accentColor}22`
          : isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'
      }}
    >
      {/* Left accent bar */}
      {isActive && (
        <motion.div
          layoutId={`row-accent-${user.id}`}
          className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-full"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        />
      )}

      {/* ── Avatar HUD Pod ─────────────────────────────────────── */}
      <div className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center select-none">
        {/* Rotating outer ring (CW) */}
        <div className="absolute inset-0 rounded-[30%] border border-dashed opacity-20 pointer-events-none hud-spinner-cw" style={{ borderColor: accentColor }} />
        {/* Counter-rotating inner ring (CCW) */}
        <div className="absolute inset-[3px] rounded-[30%] border border-dotted opacity-25 pointer-events-none hud-spinner-ccw" style={{ borderColor: accentColor }} />
        {/* Breathing halo */}
        {isActive && (
          <div className="absolute inset-[6px] rounded-[30%] opacity-25 hud-breath" style={{ backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}`, boxShadow: `0 0 10px ${accentColor}`, color: accentColor }} />
        )}
        {/* Shift progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="19" fill="none" stroke={accentColor} strokeWidth="1.5"
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={2 * Math.PI * 19 * (1 - shiftPct / 100)}
            strokeLinecap="round"
            style={{ opacity: isActive ? 0.7 : 0.15, filter: isActive ? `drop-shadow(0 0 3px ${accentColor})` : 'none', transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        {/* Initials */}
        <div
          className="relative w-8 h-8 rounded-[30%] flex items-center justify-center transition-all duration-300"
          style={{
            background: isActive ? `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}05 100%)` : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isActive ? `${accentColor}35` : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          <span className="text-[10px] font-black tracking-tight" style={{ color: isActive ? '#ffffff' : '#64748b', textShadow: isActive ? `0 0 8px ${accentColor}60` : 'none' }}>
            {getInitials(user.name)}
          </span>
        </div>
      </div>

      {/* ── Name + Client ──────────────────────────────────────── */}
      <div className="flex flex-col min-w-0 justify-center">
        <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
          <span className="text-[13px] font-black text-white tracking-tight truncate max-w-full" title={user.name}>
            {user.name}
          </span>
          {breakCount === 0 && brbCount === 0 && punchIn && (
            <div className="flex items-center gap-0.5 px-1 py-0.5 rounded flex-shrink-0 bg-amber-500/10 border border-amber-500/20">
              <TrendingUp size={8} className="text-amber-400" />
              <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest hidden sm:inline-block">Elite</span>
            </div>
          )}
        </div>
        <span
          className="text-[8px] font-black uppercase tracking-[0.18em] flex items-center gap-0.5"
          style={{ color: clientTheme.color, textShadow: `0 0 6px ${clientTheme.color}25` }}
        >
          <UserIcon size={8} /> {user.clientName}
        </span>
      </div>

      {/* ── Protocol column: badge + live status duration timer ── */}
      <div className="flex justify-center min-w-0">
        {renderProtocol()}
      </div>

      {/* ── Shift ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center min-w-0">
        <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.04] to-transparent pointer-events-none" />
        {renderTime(currentWorked, isWorking, shiftColor, shiftGlow)}
        {(status === 'on_break' || status === 'on_brb') && (
          <div className="mt-0.5 text-[6px] font-black uppercase tracking-[0.15em] opacity-45" style={{ color: shiftColor }}>
            paused
          </div>
        )}
      </div>

      {/* ── Break ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center min-w-0">
        <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent pointer-events-none" />
        {renderTime(currentBreak, status === 'on_break', breakColor, breakGlow)}
      </div>

      {/* ── BRB ───────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center min-w-0">
        <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent pointer-events-none" />
        {renderTime(currentBrb, status === 'on_brb', brbColor, brbGlow)}
      </div>

      {/* ── Total Break ───────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center min-w-0">
        <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent pointer-events-none" />
        {renderTime(currentTotalBreak, status === 'on_break' || status === 'on_brb', totalColor, totalGlow)}
        {currentTotalBreak > 0 && (
          <div className="mt-1 h-[2px] w-10 rounded-full overflow-hidden bg-white/[0.04]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((totalMin / 85) * 100, 100)}%`, background: totalColor, boxShadow: `0 0 3px ${totalColor}` }} />
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center gap-1.5">
        <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.04] to-transparent pointer-events-none" />

        {/* Resume from break */}
        {status === 'on_break' && onEndBreak && (
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEndBreak(user.id)}
            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] py-1.5 px-2.5 rounded-full cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.06) 100%)',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fbbf24',
              boxShadow: '0 0 12px rgba(251,191,36,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
              textShadow: '0 0 8px rgba(251,191,36,0.7)',
            }}
          >
            <Play size={7} className="fill-current flex-shrink-0" />
            Resume
          </motion.button>
        )}

        {/* End BRB */}
        {status === 'on_brb' && onEndBrb && (
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEndBrb(user.id)}
            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] py-1.5 px-2.5 rounded-full cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(59,130,246,0.4)',
              color: '#60a5fa',
              boxShadow: '0 0 12px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
              textShadow: '0 0 8px rgba(59,130,246,0.7)',
            }}
          >
            <Coffee size={7} className="flex-shrink-0" />
            End BRB
          </motion.button>
        )}

        {/* Offline placeholder */}
        {!isActive && !punchIn && (
          <div className="text-[7px] font-black tracking-[0.18em] text-slate-700 uppercase font-mono select-none px-2 py-1 rounded-full border border-white/[0.03]">
            OFFLINE
          </div>
        )}

        {/* Hover actions: punch out / edit */}
        <div className={`flex items-center gap-0.5 transition-all duration-200 ${isActive ? 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto' : 'opacity-100'}`}>
          {status === 'working' && onPunchOut && (
            <button onClick={() => onPunchOut(user.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" title="Punch out">
              <LogOut size={12} />
            </button>
          )}
          {onEditLogs && punchIn && (
            <button onClick={() => onEditLogs(user.id, user.name, user.clientName)} className="p-1.5 text-slate-600 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all" title="Edit logs">
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

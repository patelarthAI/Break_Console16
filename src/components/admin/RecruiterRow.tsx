'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDuration } from '@/lib/timeUtils';
import type { UserStatusRecord } from '@/lib/store';
import { Pencil, LogOut, TrendingUp, User as UserIcon } from 'lucide-react';

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

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/* HH:MM:SS but drop a leading "00:" for compactness */
function fmtShort(ms: number) {
  const d = formatDuration(ms);
  return d.startsWith('00:') ? d.slice(3) : d;
}



export default function RecruiterRow({ record, isOnLeave, onEndBreak, onEndBrb, onPunchOut, onEditLogs }: RecruiterRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { user, status: rawStatus, workedMs, breakMs, brbMs, punchIn, workStart, breakCount, brbCount } = record;
  const status = isOnLeave ? ('on_leave' as const) : rawStatus;
  const isActive = status === 'working' || status === 'on_break' || status === 'on_brb';
  const isWorking = status === 'working';
  const now = Date.now();

  const workingElapsed = workStart ? now - workStart : 0;
  const totalBreak = (breakMs || 0) + (brbMs || 0);

  const shiftLimitMs = 9 * 60 * 60 * 1000;
  const currentWorked = isWorking ? (workedMs + workingElapsed) : workedMs;
  const shiftPct = Math.min(100, Math.max(0, (currentWorked / shiftLimitMs) * 100));

  const displayStatus = status.replace('on_', '').replace('_', ' ').toUpperCase();

  let accentColor = '#64748b'; // Idle
  if (status === 'working') accentColor = '#00F5A0';
  else if (status === 'on_break') accentColor = '#FBBF24';
  else if (status === 'on_brb') accentColor = '#3b82f6';
  else if (status === 'on_leave') accentColor = '#8b5cf6';

  const glowClass =
    status === 'working' ? 'glow-avatar-working' :
    status === 'on_break' ? 'glow-avatar-break' :
    status === 'on_brb' ? 'glow-avatar-brb' :
    status === 'on_leave' ? 'glow-avatar-leave' : '';

  // Compliance limit minutes calculations
  const shiftMin = currentWorked / 60000;
  const breakMin = (breakMs || 0) / 60000;
  const brbMin = (brbMs || 0) / 60000;
  const totalMin = totalBreak / 60000;

  // Shift column color & glow
  let shiftColor = '#475569';
  let shiftGlow = 'none';
  if (isWorking) {
    if (shiftMin > 540) { // Over 9h
      shiftColor = '#ef4444';
      shiftGlow = '0 0 12px #ef4444, 0 0 4px #ef4444';
    } else if (shiftMin > 510) { // Over 8.5h
      shiftColor = '#f59e0b';
      shiftGlow = '0 0 8px #f59e0b';
    } else {
      shiftColor = '#00F5A0';
      shiftGlow = '0 0 10px rgba(0, 245, 160, 0.4)';
    }
  } else if (punchIn) {
    if (shiftMin > 540) {
      shiftColor = '#ef4444';
      shiftGlow = '0 0 8px rgba(239, 68, 68, 0.3)';
    } else if (shiftMin > 510) {
      shiftColor = '#f59e0b';
    } else {
      shiftColor = '#cbd5e1';
    }
  }

  // Break column color & glow
  let breakColor = 'rgba(255, 255, 255, 0.22)';
  let breakGlow = 'none';
  if (breakMin > 0) {
    if (breakMin > 75) { // Over 75m budget
      breakColor = '#ef4444';
      breakGlow = '0 0 12px #ef4444, 0 0 4px #ef4444';
    } else if (breakMin > 60) { // Over 60m warning
      breakColor = '#f59e0b';
      breakGlow = '0 0 8px #f59e0b';
    } else {
      breakColor = '#f59e0b';
      if (status === 'on_break') {
        breakGlow = '0 0 8px rgba(245, 158, 11, 0.4)';
      }
    }
  }

  // BRB column color & glow
  let brbColor = 'rgba(255, 255, 255, 0.22)';
  let brbGlow = 'none';
  if (brbMin > 0) {
    if (brbMin > 10) { // Over 10m budget
      brbColor = '#ef4444';
      brbGlow = '0 0 12px #ef4444, 0 0 4px #ef4444';
    } else if (brbMin > 8) { // Over 8m warning
      brbColor = '#f59e0b';
      brbGlow = '0 0 8px #f59e0b';
    } else {
      brbColor = '#3b82f6';
      if (status === 'on_brb') {
        brbGlow = '0 0 8px rgba(59, 130, 246, 0.4)';
      }
    }
  }

  // Total Break column color & glow
  let totalColor = 'rgba(255, 255, 255, 0.22)';
  let totalGlow = 'none';
  if (totalBreak > 0) {
    if (totalMin > 85) { // Over 85m total cap
      totalColor = '#ef4444';
      totalGlow = '0 0 12px #ef4444, 0 0 4px #ef4444';
    } else if (totalMin > 70) { // Over 70m warning
      totalColor = '#f59e0b';
      totalGlow = '0 0 8px #f59e0b';
    } else {
      totalColor = '#94a3b8';
    }
  }

  // Primary "shift" value: live timer while working, else accumulated worked
  const shiftValue = isWorking ? formatElapsed(workingElapsed) : fmtShort(workedMs);

  // LCD Clock background values (replacing all digits with '8' to match layout & size exactly)
  const shiftLcdBg = shiftValue.replace(/[0-9]/g, '8');
  const breakLcdBg = fmtShort(breakMs || 0).replace(/[0-9]/g, '8');
  const brbLcdBg = fmtShort(brbMs || 0).replace(/[0-9]/g, '8');
  const totalLcdBg = fmtShort(totalBreak).replace(/[0-9]/g, '8');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative grid grid-cols-[44px_1fr_100px_85px_85px_85px_95px_100px] items-center gap-4 px-6 py-2 rounded-2xl group transition-all duration-300 ${
        isActive
          ? 'bg-gradient-to-r from-white/[0.02] to-white/[0.005] shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md'
          : 'bg-white/[0.01] hover:bg-white/[0.02] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]'
      } border`}
      style={{
        borderColor: isActive
          ? isHovered ? `${accentColor}50` : `${accentColor}25`
          : isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'
      }}
    >
      {/* Left accent for active */}
      {isActive && (
        <motion.div
          layoutId={`row-accent-${user.id}`}
          className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full blur-[0.5px]"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
        />
      )}

      {/* Biometric HUD Pod Avatar */}
      <div className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center select-none">
        {/* Rotating outer compass ring (CW) */}
        <div 
          className="absolute inset-0 rounded-full border border-dashed opacity-20 pointer-events-none hud-spinner-cw"
          style={{ borderColor: accentColor }}
        />
        
        {/* Counter-rotating outer ticks ring (CCW) */}
        <div 
          className="absolute inset-[3px] rounded-full border border-dotted opacity-30 pointer-events-none hud-spinner-ccw"
          style={{ borderColor: accentColor }}
        />

        {/* Pulsing state glow breathing halo */}
        <div 
          className="absolute inset-[6px] rounded-xl opacity-30 hud-breath"
          style={{ 
            backgroundColor: `${accentColor}12`,
            border: `1px solid ${accentColor}`,
            boxShadow: `0 0 12px ${accentColor}`,
            color: accentColor,
          }}
        />

        {/* SVG Biometric Shift Completion Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 44 44">
          <circle
            cx="22" cy="22" r="19"
            fill="none"
            stroke="rgba(255,255,255,0.02)"
            strokeWidth="1.5"
          />
          <circle
            cx="22" cy="22" r="19"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.5"
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={2 * Math.PI * 19 * (1 - shiftPct / 100)}
            strokeLinecap="round"
            style={{
              opacity: isActive ? 0.75 : 0.2,
              filter: isActive ? `drop-shadow(0 0 3px ${accentColor})` : 'none',
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Center node with initials */}
        <div
          className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 overflow-hidden"
          style={{
            background: isActive
              ? `linear-gradient(135deg, ${accentColor}25 0%, ${accentColor}05 100%)`
              : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isActive ? `${accentColor}40` : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          {/* HUD Crosshairs when inactive */}
          {!isActive && (
            <div className="absolute inset-0 pointer-events-none opacity-20">
              {/* Vertical line ticks */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-500 scale-y-50 -translate-x-1/2" />
              {/* Horizontal line ticks */}
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-500 scale-x-50 -translate-y-1/2" />
              {/* Center point */}
              <div className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-slate-500 -translate-x-1/2 -translate-y-1/2 opacity-45" />
            </div>
          )}

          <span
            className="relative z-10 text-[10px] font-black tracking-tight"
            style={{ 
              color: isActive ? '#ffffff' : '#64748b', 
              textShadow: isActive ? `0 0 8px ${accentColor}60` : 'none' 
            }}
          >
            {getInitials(user.name)}
          </span>
        </div>

        {/* Tiny live pulsator node at the top-right of the HUD pod */}
        {isActive && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#06070a] p-0.5 z-20">
            <div className="w-full h-full rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
          </div>
        )}
      </div>

      {/* Name + client */}
      <div className="flex flex-col min-w-0 justify-center">
        <div className="flex items-center gap-2 mb-0.5 min-w-0">
          <span className="text-[14px] font-black text-white tracking-tight truncate max-w-full group-hover:text-glow transition-all duration-300" title={user.name}>
            {user.name}
          </span>
          {breakCount === 0 && brbCount === 0 && punchIn && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded flex-shrink-0 bg-amber-500/10 border border-amber-500/20">
              <TrendingUp size={9} className="text-amber-400" />
              <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest hidden sm:inline-block">Elite</span>
            </div>
          )}
        </div>
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
          <UserIcon size={9} /> {user.clientName}
        </span>
      </div>

      {/* Status badge */}
      <div className="flex justify-center min-w-0">
        <div
          className={`badge ${
            status === 'working' ? 'badge-working' :
            status === 'on_break' ? 'badge-break' :
            status === 'on_brb' ? 'badge-brb' :
            status === 'on_leave' ? 'badge-leave' : 'badge-idle'
          } py-1 px-3.5`}
        >
          {displayStatus}
        </div>
      </div>

      {/* 4. Shift Column */}
      <div className="relative flex flex-col items-end justify-center min-w-0 pr-1">
        <span className="absolute right-1 text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none text-white/[0.015] pointer-events-none select-none">
          {shiftLcdBg}
        </span>
        <span
          className="relative text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none transition-all duration-300 z-10"
          style={{
            color: shiftColor,
            textShadow: shiftGlow,
          }}
        >
          {shiftValue}
        </span>
      </div>

      {/* 5. Break Column */}
      <div className="relative flex flex-col items-end justify-center min-w-0 pr-1">
        <span className="absolute right-1 text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none text-white/[0.015] pointer-events-none select-none">
          {breakLcdBg}
        </span>
        <span
          className="relative text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none transition-all duration-300 z-10"
          style={{
            color: breakColor,
            textShadow: breakGlow,
          }}
        >
          {fmtShort(breakMs || 0)}
        </span>
      </div>

      {/* 6. BRB Column */}
      <div className="relative flex flex-col items-end justify-center min-w-0 pr-1">
        <span className="absolute right-1 text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none text-white/[0.015] pointer-events-none select-none">
          {brbLcdBg}
        </span>
        <span
          className="relative text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none transition-all duration-300 z-10"
          style={{
            color: brbColor,
            textShadow: brbGlow,
          }}
        >
          {fmtShort(brbMs || 0)}
        </span>
      </div>

      {/* 7. Total Break Column (Dynamic color by violation thresholds) */}
      <div className="relative flex flex-col items-end justify-center min-w-0 pr-1">
        <span className="absolute right-1 text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none text-white/[0.015] pointer-events-none select-none">
          {totalLcdBg}
        </span>
        <span
          className="relative text-[15px] sm:text-[16px] font-black font-mono tabular-nums tracking-tight leading-none transition-all duration-300 z-10"
          style={{
            color: totalColor,
            textShadow: totalGlow,
          }}
        >
          {fmtShort(totalBreak)}
        </span>
        {totalBreak > 0 && (
          <div className="mt-1.5 h-[2px] w-12 rounded-full overflow-hidden bg-white/[0.04] z-10">
            <div 
              className="h-full rounded-full transition-all duration-500" 
              style={{ 
                width: `${Math.min((totalMin / 85) * 100, 100)}%`, 
                background: totalColor, 
                boxShadow: `0 0 4px ${totalColor}` 
              }} 
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pr-2">
        {status === 'on_break' && onEndBreak && (
          <button onClick={() => onEndBreak(user.id)} className="btn-3d-warning text-[10px] font-black py-2 px-3 rounded-xl whitespace-nowrap">RESUME</button>
        )}
        {status === 'on_brb' && onEndBrb && (
          <button onClick={() => onEndBrb(user.id)} className="btn-3d-info text-[10px] font-black py-2 px-3 rounded-xl whitespace-nowrap">END BRB</button>
        )}
        
        {/* Placeholder if offline & not punched in to balance layout */}
        {!isActive && !punchIn && (
          <div className="text-[9px] font-black tracking-[0.15em] text-slate-800 uppercase select-none pr-1">
            Locked
          </div>
        )}

        <div className={`flex items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto' : 'opacity-100'}`}>
          {status === 'working' && onPunchOut && (
            <button onClick={() => onPunchOut(user.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" title="Punch out"><LogOut size={15} /></button>
          )}
          {onEditLogs && punchIn && (
            <button onClick={() => onEditLogs(user.id, user.name, user.clientName)} className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all" title="Edit logs"><Pencil size={15} /></button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

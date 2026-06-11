'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, Coffee, RotateCcw, Clock3, Play } from 'lucide-react';
import { User, TimeLog } from '@/types';
import TopBar from './elite/TopBar';
import ControlCenter from './elite/ControlCenter';
import Timeline from './elite/Timeline';
import RightPanel from './elite/RightPanel';
import { getWeeklyBreakStats } from '@/lib/store';
import ConfirmDialog from '@/components/ConfirmDialog';

/* Status → hex color — shared by ambient system */
const STATUS_HEX: Record<string, string> = {
  working:     '#00F5A0',
  on_break:    '#FBBF24',
  on_brb:      '#A78BFA',
  idle:        '#FF2D55',
  punched_out: '#6B7280',
};

interface EliteDashboardProps {
  user: User;
  status: string;
  workedMs: number;
  breakMs: number;
  brbMs: number;
  teamStatus: any;
  logs: TimeLog[];
  onAction: (action: string) => void;
  onLogout: () => void;
  brbCount?: number;
  totalBreakMs?: number;
}

/* ─── Action Tiles panel — sits above Activity feed ─────────── */
function hex2rgb(hex: string) {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

function ActionTile({ label, sub, color, Icon, onClick, disabled, primary, gridSpan }: {
  label: string; sub: string; color: string; Icon: React.ElementType;
  onClick: () => void; disabled: boolean; primary: boolean; gridSpan?: number;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const rgb = hex2rgb(color);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    const tiltX = -(mouseY / (height / 2)) * 6;
    const tiltY = (mouseX / (width / 2)) * 6;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <motion.button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      className="laser-btn shimmer-sweep"
      style={{
        gridColumn: gridSpan ? '1 / -1' : 'auto',
        width: '100%',
        height: gridSpan ? 68 : 78,
        borderRadius: 18,
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none',
        opacity: disabled ? 0.22 : 1,
        border: '1px solid rgba(255,255,255,0.06)',
        background: disabled
          ? 'rgba(255,255,255,0.01)'
          : primary
            ? `linear-gradient(145deg, rgba(${rgb},0.12) 0%, rgba(${rgb},0.03) 100%)`
            : 'rgba(255,255,255,0.02)',
        boxShadow: primary && !disabled
          ? `0 0 24px rgba(${rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.06)`
          : 'none',
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.1s ease-out, background 0.2s ease, border-color 0.2s ease, opacity 0.3s ease',
        '--glow-color': color,
      } as React.CSSProperties}
    >
      {primary && !disabled && (
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1.5,
          background: `linear-gradient(90deg, transparent, ${color}cc, transparent)`,
          boxShadow: `0 0 6px ${color}aa`,
          zIndex: 3,
        }} />
      )}
      
      <div style={{
        position: 'absolute', inset: 1, borderRadius: 19,
        background: disabled
          ? '#080811'
          : primary
            ? 'linear-gradient(160deg, #110f22 0%, #08070e 100%)'
            : 'linear-gradient(160deg, #0e0d1a 0%, #06050a 100%)',
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
        padding: '0 22px', zIndex: 1,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: disabled
            ? 'rgba(255,255,255,0.02)'
            : primary
              ? `rgba(${rgb},0.20)`
              : `rgba(${rgb},0.08)`,
        }}>
          <Icon size={22} strokeWidth={2.2} style={{
            color: disabled ? 'rgba(255,255,255,0.2)' : primary ? '#fff' : color,
            filter: primary && !disabled ? `drop-shadow(0 0 6px ${color}80)` : 'none',
            transition: 'color 0.2s ease',
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <span style={{
            fontSize: 15, fontWeight: 800, color: disabled ? 'rgba(255,255,255,0.28)' : '#fff',
            fontFamily: "'Satoshi', system-ui, sans-serif", lineHeight: 1.2,
          }}>{label}</span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: disabled
              ? 'rgba(255,255,255,0.12)'
              : primary
                ? `rgba(${rgb},0.80)`
                : `rgba(${rgb},0.40)`,
            fontFamily: "'Satoshi', system-ui, sans-serif", lineHeight: 1,
          }}>{sub}</span>
        </div>
      </div>
    </motion.button>
  );
}

function ActionTiles({ status, onAction, onClockOutClick }: { status: string; onAction: (a: string) => void; onClockOutClick: () => void }) {
  const isWorking = status === 'working';
  const isOnBreak = status === 'on_break';
  const isOnBrb   = status === 'on_brb';
  const isIdle    = status === 'idle' || status === 'punched_out';
  return (
    <div style={{
      flexShrink: 0,
      background: 'transparent',
      padding: '16px 16px 8px 16px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {isIdle && (
          <>
            <ActionTile label="Clock In" sub="Start shift" color="#00F5A0" Icon={LogIn}
              onClick={() => onAction('punch_in')} disabled={false} primary={true} gridSpan={2} />
            <ActionTile label="Clock Out" sub="End shift" color="#FF3B5C" Icon={LogOut}
              onClick={() => {}} disabled={true} primary={false} gridSpan={2} />
          </>
        )}

        {isWorking && (
          <>
            <ActionTile label="Break" sub="Step away" color="#FBBF24" Icon={Coffee}
              onClick={() => onAction('break_start')} disabled={false} primary={true} />
            <ActionTile label="BRB" sub="Quick away" color="#A78BFA" Icon={Clock3}
              onClick={() => onAction('brb_start')} disabled={false} primary={false} />
            <ActionTile label="Clock Out" sub="End shift" color="#FF3B5C" Icon={LogOut}
              onClick={onClockOutClick}
              disabled={false} primary={false} gridSpan={2} />
          </>
        )}

        {isOnBreak && (
          <>
            <ActionTile label="Resume" sub="Back from break" color="#FBBF24" Icon={Play}
              onClick={() => onAction('break_end')} disabled={false} primary={true} gridSpan={2} />
            <ActionTile label="Clock Out" sub="End shift" color="#FF3B5C" Icon={LogOut}
              onClick={() => {}} disabled={true} primary={false} gridSpan={2} />
          </>
        )}

        {isOnBrb && (
          <>
            <ActionTile label="I'm Back" sub="Return" color="#A78BFA" Icon={RotateCcw}
              onClick={() => onAction('brb_end')} disabled={false} primary={true} gridSpan={2} />
            <ActionTile label="Clock Out" sub="End shift" color="#FF3B5C" Icon={LogOut}
              onClick={() => {}} disabled={true} primary={false} gridSpan={2} />
          </>
        )}
      </div>
      {/* Keyboard hints */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 5 }}>
        {[['P','Punch'],['B','Break'],['R','BRB']].map(([k,l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <kbd style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: 4,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
              fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.22)',
              fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
            }}>{k}</kbd>
            <span style={{
              fontSize: 7.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.15)', fontFamily: "'Satoshi', system-ui, sans-serif",
            }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ConfirmModal replaced in favor of shared ConfirmDialog

export default function EliteDashboard({
  user, status, workedMs, breakMs, brbMs,
  teamStatus, logs, onAction, onLogout, brbCount, totalBreakMs,
}: EliteDashboardProps) {
  const [now, setNow] = useState(Date.now());
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  /* ── Cursor-reactive ambient glow ───────────────────────── */
  const cursorX = useMotionValue(-600);
  const cursorY = useMotionValue(-600);
  const springX = useSpring(cursorX, { damping: 28, stiffness: 200 });
  const springY = useSpring(cursorY, { damping: 28, stiffness: 200 });
  useEffect(() => {
    const h = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY); };
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const statusColor = STATUS_HEX[status] ?? STATUS_HEX.idle;

  // Clock: ticks every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Weekly stats
  useEffect(() => {
    getWeeklyBreakStats()
      .then((data) => { if (data && data.length > 0) setWeeklyStats(data); })
      .catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'b') {
        if (status === 'working') onAction('break_start');
        else if (status === 'on_break') onAction('break_end');
      } else if (k === 'r') {
        if (status === 'working') onAction('brb_start');
        else if (status === 'on_brb') onAction('brb_end');
      } else if (k === 'p') {
        if (status === 'idle' || status === 'punched_out') onAction('punch_in');
        else setShowConfirmModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, onAction]);

  const BREAK_THRESHOLD_MS = 85 * 60 * 1000;

  const dynamicAuraLeaders = useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return [];
    return [...weeklyStats]
      .filter(s => {
        const isWfo = s.user.workMode === 'WFO';
        const fullAttendance = s.daysChecked === s.expectedDays;
        const onTime = s.lateInDays === 0;
        const breakCompliant = s.breakViolDays === 0;
        const brbCompliant = s.brbViolDays === 0;
        const combinedCompliant = s.combinedViolDays === 0;
        return isWfo && fullAttendance && onTime && breakCompliant && brbCompliant && combinedCompliant;
      })
      .sort((a, b) => (a.avgBreakMs + a.avgBrbMs) - (b.avgBreakMs + b.avgBrbMs))
      .slice(0, 3);
  }, [weeklyStats]);

  const dynamicLobbyCampers = useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return [];
    return [...weeklyStats]
      .filter(s => s.daysChecked >= 1 && s.avgBreakMs + s.avgBrbMs > 85 * 60 * 1000)
      .sort((a, b) => (b.avgBreakMs + b.avgBrbMs) - (a.avgBreakMs + a.avgBrbMs))
      .slice(0, 3);
  }, [weeklyStats]);

  const auraLeadersToRender = useMemo(() => {
    if (dynamicAuraLeaders.length > 0) {
      return dynamicAuraLeaders.map(m => ({
        name: m.user.name,
        clientName: m.user.clientName,
        avgBreakMs: (m.totalBreakMs + m.totalBrbMs) / m.daysChecked,
      }));
    }
    return [];
  }, [dynamicAuraLeaders]);

  const lobbyCampersToRender = useMemo(() => {
    if (dynamicLobbyCampers.length > 0) {
      return dynamicLobbyCampers.map(m => ({
        name: m.user.name,
        clientName: m.user.clientName,
        avgBreakMin: Math.round((m.totalBreakMs + m.totalBrbMs) / m.daysChecked / 60000),
      }));
    }
    return [];
  }, [dynamicLobbyCampers]);
  return (
    <div 
      className="dashboard-container"
      style={{
        background: '#07060e',
        fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
        position: 'relative',
      }}
    >

      {/* Dynamic Style injection */}
      <style>{`
        @keyframes border-spin {
          100% { transform: rotate(360deg); }
        }
        .laser-btn {
          position: relative;
          overflow: hidden;
        }
        .laser-btn::before {
          content: '';
          position: absolute;
          inset: -150%;
          background: conic-gradient(from 0deg, transparent 70%, var(--glow-color, #00F5A0) 90%, var(--glow-color, #00F5A0) 100%);
          animation: border-spin 4s linear infinite;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
          pointer-events: none;
        }
        .laser-btn:hover:not(:disabled)::before {
          opacity: 1;
        }
        
        .shimmer-sweep::after {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 60%; height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.08) 50%,
            transparent
          );
          transform: skewX(-20deg);
          z-index: 2;
          pointer-events: none;
        }
        .shimmer-sweep:hover:not(:disabled)::after {
          left: 150%;
          transition: left 0.75s ease-in-out;
        }
        
        /* Twinkling star field */
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.85; }
        }
        .star-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image: 
            radial-gradient(1px 1px at 10% 12%, #fff 100%, transparent),
            radial-gradient(1px 1px at 25% 45%, #fff 100%, transparent),
            radial-gradient(1px 1px at 45% 85%, #fff 100%, transparent),
            radial-gradient(1.5px 1.5px at 65% 22%, #fff 100%, transparent),
            radial-gradient(1px 1px at 80% 55%, #fff 100%, transparent),
            radial-gradient(1.5px 1.5px at 90% 78%, #fff 100%, transparent);
          background-size: 550px 550px;
          opacity: 0.4;
          z-index: 0;
          animation: star-twinkle 6s ease-in-out infinite;
        }

        /* Locked Laptop-Only Bento Layout */
        .dashboard-container {
          height: 100vh;
          min-height: 650px;
          min-width: 1024px;
          overflow: auto;
          display: flex;
          flex-direction: column;
        }
        
        .dashboard-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 420px minmax(0, 1fr) 250px;
          grid-template-rows: minmax(0, 1fr);
          gap: 12px;
          padding: 8px 12px 10px;
          min-height: 0;
          overflow: hidden;
        }

        @media (max-width: 1366px) {
          .dashboard-grid {
            grid-template-columns: 360px minmax(0, 1fr) 235px;
            gap: 10px;
            padding: 6px 10px 8px;
          }
        }
      `}</style>

      {/* Twinkling starfield backdrop overlay */}
      <div className="star-layer" />

      {/* ═══ LAYER 0: Fixed aurora orbs (always purple/emerald brand) ═══ */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-5%', width: 650, height: 650,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, rgba(124,58,237,0.06) 50%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
        animation: 'aurora-float 18s ease-in-out infinite',
      }} />
      <div style={{
        position: 'fixed', bottom: '5%', left: '5%', width: 550, height: 550,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,245,160,0.09) 0%, rgba(0,224,255,0.04) 50%, transparent 70%)',
        filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0,
        animation: 'aurora-float-b 24s ease-in-out infinite',
      }} />

      {/* ═══ LAYER 1: Status-reactive ambient color — entire page breathes with state ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: `
              radial-gradient(ellipse 60% 60% at 16% 50%, ${statusColor}18 0%, transparent 65%),
              radial-gradient(ellipse 35% 40% at 85% 12%, ${statusColor}0c 0%, transparent 55%)
            `,
          }}
        />
      </AnimatePresence>

      {/* ═══ LAYER 2: Cursor-reactive glow — follows mouse, colored by status ═══ */}
      <motion.div
        style={{
          position: 'fixed', zIndex: 1, pointerEvents: 'none',
          width: 560, height: 560, borderRadius: '50%',
          background: `radial-gradient(circle, ${statusColor}16 0%, ${statusColor}08 35%, transparent 65%)`,
          filter: 'blur(45px)',
          x: springX, y: springY,
          translateX: '-50%', translateY: '-50%',
        }}
      />

      {/* ═══ CONTENT LAYER ═══ */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Bar */}
      <TopBar user={user} onLogout={onLogout} />

      {/* Main body — 3-col: ControlCenter | Bento Column | RightPanel */}
      <div className="dashboard-grid">

        {/* ── LEFT: Control Center ── */}
        <div className="dashboard-col" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
          <ControlCenter
            now={now} user={user} status={status}
            workedMs={workedMs} breakMs={breakMs} brbMs={brbMs}
            onAction={onAction} logs={logs}
          />
        </div>

        {/* ── CENTER: Unified Bento Column ── */}
        <div className="dashboard-col" style={{
          flex: 1, minWidth: 0, height: '100%',
          background: 'linear-gradient(160deg, rgba(11,10,24,0.98) 0%, rgba(6,5,15,1) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(40px)',
          borderRadius: 20,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.02), 0 24px 64px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <ActionTiles status={status} onAction={onAction} onClockOutClick={() => setShowConfirmModal(true)} />
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 16px', flexShrink: 0 }} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Timeline logs={logs} />
          </div>
        </div>

        {/* ── RIGHT: Panel ── */}
        <div className="dashboard-col" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
          <RightPanel user={user} leaders={auraLeadersToRender} campers={lobbyCampersToRender} />
        </div>

      </div>
      </div>{/* end content layer */}
      <ConfirmDialog
        open={showConfirmModal}
        title="End Your Shift?"
        message="This action will log your departure time, stop shift worked tracking, and log you out of active status."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          onAction('punch_out');
          setShowConfirmModal(false);
        }}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}

'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, LogOut, Coffee, RotateCcw, Clock3 } from 'lucide-react';

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

interface BtnProps {
  label: string;
  sub: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  color: string;
  Icon: React.ElementType;
}

function Btn({ label, sub, onClick, disabled, primary, color, Icon }: BtnProps) {
  const [hov, setHov] = useState(false);
  const [down, setDown] = useState(false);

  const bg = disabled
    ? 'rgba(255,255,255,0.015)'
    : primary
      ? `linear-gradient(145deg, ${rgba(color,0.22)} 0%, ${rgba(color,0.10)} 100%)`
      : down  ? rgba(color, 0.16)
      : hov   ? rgba(color, 0.10)
      :         rgba(color, 0.05);

  const border = disabled
    ? 'rgba(255,255,255,0.06)'
    : primary  ? rgba(color, 0.60)
    : down     ? rgba(color, 0.70)
    : hov      ? rgba(color, 0.40)
    :            rgba(color, 0.20);

  const iconColor  = disabled ? 'rgba(255,255,255,0.14)' : primary ? '#fff' : hov ? '#fff' : color;
  const labelColor = disabled ? 'rgba(255,255,255,0.18)' : primary ? '#fff' : hov ? '#fff' : rgba(color, 0.90);
  const subColor   = disabled ? 'rgba(255,255,255,0.08)' : rgba(color, 0.40);

  return (
    <motion.button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setDown(false); }}
      onMouseDown={() => !disabled && setDown(true)}
      onMouseUp={() => setDown(false)}
      whileHover={!disabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.75 }}
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 6,
        height: '100%',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none', userSelect: 'none',
        boxShadow: primary
          ? `0 0 40px ${rgba(color,0.28)}, 0 0 90px ${rgba(color,0.06)}, 0 8px 32px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.28)`
          : hov && !disabled
            ? `0 0 20px ${rgba(color,0.15)}, 0 4px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)`
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Primary top accent line */}
      {primary && (
        <div style={{
          position: 'absolute', top: 0, left: '18%', right: '18%', height: 1.5,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          boxShadow: `0 0 10px ${rgba(color, 0.9)}`,
        }} />
      )}
      {/* Hover shimmer */}
      {hov && !disabled && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      <Icon
        size={primary ? 22 : 18} strokeWidth={2}
        style={{
          color: iconColor,
          filter: primary ? `drop-shadow(0 0 8px ${rgba(color,0.7)})` : hov ? `drop-shadow(0 0 5px ${rgba(color,0.4)})` : 'none',
          transition: 'all 0.16s',
          opacity: disabled ? 0.35 : 1,
        }}
      />
      <span style={{
        fontSize: 12, fontWeight: 800, letterSpacing: '0.09em',
        textTransform: 'uppercase', color: labelColor,
        fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
        lineHeight: 1, transition: 'color 0.16s',
      }}>{label}</span>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: subColor,
        fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
        lineHeight: 1,
      }}>{sub}</span>
    </motion.button>
  );
}

interface ActionBandProps { status: string; onAction: (a: string) => void; }

export default function ActionBand({ status, onAction }: ActionBandProps) {
  const isWorking = status === 'working';
  const isOnBreak = status === 'on_break';
  const isOnBrb   = status === 'on_brb';
  const isIdle    = status === 'idle' || status === 'punched_out';

  const handlePunchOut = () => {
    if (window.confirm('End your shift and punch out?')) onAction('punch_out');
  };

  const col = isWorking ? '#00F5A0' : isOnBreak ? '#FFD700' : isOnBrb ? '#D8B4FE' : '#00F5A0';

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(10,8,22,0.98) 0%, rgba(6,5,15,1) 100%)',
      border: `1px solid ${rgba(col, 0.16)}`,
      borderTop: `1.5px solid ${rgba(col, 0.55)}`,
      borderRadius: 20,
      padding: 10,
      boxShadow: `
        0 0 0 1px rgba(255,255,255,0.025),
        0 0 56px ${rgba(col,0.08)},
        0 20px 50px rgba(0,0,0,0.88),
        inset 0 1px 0 rgba(255,255,255,0.06),
        inset 0 -1px 0 rgba(0,0,0,0.35)
      `,
      backdropFilter: 'blur(32px)',
      transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
    }}>
      <div key={status} style={{
        display: 'flex', gap: 8, height: 80,
        animation: 'action-fade-up 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* CLOCK IN */}
        <Btn label="Clock In"  sub="Start shift" Icon={LogIn} color="#00F5A0"
          onClick={() => onAction('punch_in')}
          disabled={!isIdle} primary={isIdle} />

        {/* CLOCK OUT */}
        <Btn label="Clock Out" sub="End shift" Icon={LogOut} color="#FF2D55"
          onClick={handlePunchOut}
          disabled={isIdle} primary={false} />

        {/* Thin separator */}
        <div style={{ width: 1, margin: '10px 2px', background: 'rgba(255,255,255,0.07)', borderRadius: 1, flexShrink: 0 }} />

        {/* BREAK */}
        <Btn label="Break" sub="Step away" Icon={Coffee} color="#FFD700"
          onClick={() => onAction('break_start')}
          disabled={!isWorking} primary={isWorking} />

        {/* RESUME */}
        <Btn label="Resume" sub="I'm back" Icon={RotateCcw} color="#FFD700"
          onClick={() => onAction('break_end')}
          disabled={!isOnBreak} primary={isOnBreak} />

        {/* Thin separator */}
        <div style={{ width: 1, margin: '10px 2px', background: 'rgba(255,255,255,0.07)', borderRadius: 1, flexShrink: 0 }} />

        {/* BRB */}
        <Btn label="BRB" sub="Quick away" Icon={Clock3} color="#D8B4FE"
          onClick={() => onAction('brb_start')}
          disabled={!isWorking} primary={false} />

        {/* I'M BACK */}
        <Btn label="I'm Back" sub="Return" Icon={RotateCcw} color="#D8B4FE"
          onClick={() => onAction('brb_end')}
          disabled={!isOnBrb} primary={isOnBrb} />

      </div>

      {/* Footer: keyboard hints */}
      <div style={{
        marginTop: 6, paddingTop: 6,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
      }}>
        {[['P', 'Punch'], ['B', 'Break'], ['R', 'BRB']].map(([k, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 5,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.30)',
              fontFamily: "'Geist Mono', monospace", letterSpacing: 0,
            }}>{k}</span>
            <span style={{
              fontSize: 8, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)',
              fontFamily: "'Satoshi', system-ui, sans-serif",
            }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

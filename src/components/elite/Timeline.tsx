'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '@/lib/timeUtils';
import { TimeLog } from '@/types';

interface TimelineProps {
  logs: TimeLog[];
}

const EVENT_CONFIG: Record<string, { color: string; glow: string; bg: string; label: string; border: string }> = {
  punch_in: {
    color: '#00F5A0',
    glow: 'rgba(0,245,160,0.35)',
    bg: 'rgba(0,245,160,0.08)',
    border: 'rgba(0,245,160,0.22)',
    label: 'PUNCH IN',
  },
  punch_out: {
    color: '#FF2D55',
    glow: 'rgba(255,45,85,0.35)',
    bg: 'rgba(255,45,85,0.08)',
    border: 'rgba(255,45,85,0.22)',
    label: 'PUNCH OUT',
  },
  break_start: {
    color: '#FBBF24',
    glow: 'rgba(251,191,36,0.35)',
    bg: 'rgba(251,191,36,0.07)',
    border: 'rgba(251,191,36,0.22)',
    label: 'BREAK START',
  },
  break_end: {
    color: '#FBBF24',
    glow: 'rgba(251,191,36,0.35)',
    bg: 'rgba(251,191,36,0.07)',
    border: 'rgba(251,191,36,0.22)',
    label: 'BREAK END',
  },
  brb_start: {
    color: '#A78BFA',
    glow: 'rgba(167,139,250,0.35)',
    bg: 'rgba(167,139,250,0.07)',
    border: 'rgba(167,139,250,0.22)',
    label: 'BRB START',
  },
  brb_end: {
    color: '#A78BFA',
    glow: 'rgba(167,139,250,0.35)',
    bg: 'rgba(167,139,250,0.07)',
    border: 'rgba(167,139,250,0.22)',
    label: 'BRB END',
  },
  auto_logout: {
    color: '#6B7280',
    glow: 'rgba(107,114,128,0.3)',
    bg: 'rgba(107,114,128,0.06)',
    border: 'rgba(107,114,128,0.18)',
    label: 'AUTO OUT',
  },
};

/** Format milliseconds into a clean duration string (e.g. "1h 23m", "45m 12s", "30s") */
function fmtDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

export default function Timeline({ logs }: TimelineProps) {
  // Chronological order (oldest first) for duration lookups
  const chronoLogs = useMemo(() => [...logs].sort((a, b) => a.timestamp - b.timestamp), [logs]);

  // Display newest-first
  const displayLogs = useMemo(() => [...chronoLogs].reverse(), [chronoLogs]);

  // Pre-compute durations for each "end" event by searching BACKWARD in chrono order
  const durations = useMemo(() => {
    const map: Record<string, string> = {};
    for (let i = 0; i < chronoLogs.length; i++) {
      const log = chronoLogs[i];
      if (log.eventType === 'break_end' || log.eventType === 'brb_end') {
        const startType = log.eventType === 'break_end' ? 'break_start' : 'brb_start';
        // Walk backwards in chrono order to find the most recent matching start
        for (let j = i - 1; j >= 0; j--) {
          if (chronoLogs[j].eventType === startType) {
            const ms = log.timestamp - chronoLogs[j].timestamp;
            map[log.id] = fmtDuration(ms);
            break;
          }
        }
      }
    }
    return map;
  }, [chronoLogs]);

  return (
    <div style={{
      background: 'transparent',
      border: 'none',
      backdropFilter: 'none',
      borderRadius: 0,
      padding: '8px 14px 12px 14px',
      flex: 1, minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'none',
    }}>
      {/* Bottom fade — indicates scroll */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:40, background:'linear-gradient(to bottom,transparent,rgba(6,5,15,0.95))', pointerEvents:'none', zIndex:10, borderRadius:'0 0 20px 20px' }} />
      {/* Minimal header — count only */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif" }}>Activity</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.22)', fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif" }}>{logs.length}</span>
      </div>

      {/* Scrollable list — thin visible scrollbar */}
      <style>{`
        .tl-scroll::-webkit-scrollbar { display: none; }
        .tl-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      <div className="tl-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 2 }}>
        {displayLogs.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '80px', fontSize: '12px',
            color: 'rgba(255,255,255,0.25)',
            fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
          }}>
            No events logged yet.
          </div>
        ) : (
          <div>
            <AnimatePresence initial={false}>
            {displayLogs.map((log, i) => {
              const cfg = EVENT_CONFIG[log.eventType] || {
                color: '#555', glow: 'rgba(85,85,85,0.3)',
                bg: 'rgba(85,85,85,0.06)', border: 'rgba(85,85,85,0.15)',
                label: log.eventType.replace(/_/g, ' ').toUpperCase(),
              };
              const isLatest = i === 0;
              const isLast = i === displayLogs.length - 1;
              const duration = durations[log.id];

              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                  style={{ position: 'relative', marginBottom: isLast ? 0 : 2 }}
                >
                  {/* Vertical connector line */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute', left: 19, top: '100%',
                      width: 1.5, height: 2,
                      background: 'rgba(255,255,255,0.07)',
                    }} />
                  )}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px 9px 8px',
                      borderRadius: 14,
                      cursor: 'default',
                      transition: 'background 0.14s ease, border-color 0.14s ease',
                      background: isLatest
                        ? `linear-gradient(90deg, ${cfg.color}0e 0%, rgba(255,255,255,0.02) 100%)`
                        : 'rgba(255,255,255,0.018)',
                      border: `1px solid ${isLatest ? cfg.color + '22' : 'rgba(255,255,255,0.05)'}`,
                      borderLeft: `2.5px solid ${isLatest ? cfg.color : cfg.color + '40'}`,
                      boxShadow: isLatest ? `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isLatest) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                        (e.currentTarget as HTMLElement).style.borderColor = `rgba(255,255,255,0.09)`;
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = isLatest
                        ? `linear-gradient(90deg, ${cfg.color}0e 0%, rgba(255,255,255,0.02) 100%)`
                        : 'rgba(255,255,255,0.018)';
                      (e.currentTarget as HTMLElement).style.borderColor = isLatest ? cfg.color + '22' : 'rgba(255,255,255,0.05)';
                    }}
                  >
                    {/* Dot */}
                    <div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isLatest ? (
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%',
                          border: `2px solid ${cfg.color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${cfg.color}18`,
                          boxShadow: `0 0 10px ${cfg.glow}`,
                          animation: 'statusPulse 2s ease-in-out infinite',
                        }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.color }} />
                        </div>
                      ) : (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, opacity: 0.6, boxShadow: `0 0 5px ${cfg.glow}` }} />
                      )}
                    </div>

                    {/* Event label */}
                    <span style={{
                      fontSize: 11, fontWeight: 800,
                      letterSpacing: '0.08em',
                      fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
                      color: isLatest ? cfg.color : `${cfg.color}b0`,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      minWidth: 96,
                    }}>{cfg.label}</span>

                    {/* Duration chip */}
                    {duration ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: '#FBBF24',
                        fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
                        padding: '2px 8px', borderRadius: 8,
                        background: 'rgba(251, 191, 36, 0.08)',
                        border: '1px solid rgba(251, 191, 36, 0.18)',
                        flexShrink: 0,
                        letterSpacing: '0.03em',
                      }}>{duration}</span>
                    ) : (
                      <div style={{ width: 0 }} />
                    )}

                    {/* Center fill — gradient line */}
                    <div style={{
                      flex: 1,
                      height: 1,
                      background: `linear-gradient(90deg, ${cfg.color}18, transparent 60%)`,
                      minWidth: 20,
                    }} />

                    {/* Timestamp */}
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      color: isLatest ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)',
                      fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.01em',
                      flexShrink: 0,
                    }}>{formatTime(log.timestamp)}</span>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

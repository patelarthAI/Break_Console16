'use client';
import React from 'react';
import { Flame, AlertTriangle, Hourglass } from 'lucide-react';

interface Camper { name: string; clientName?: string; avgBreakMin?: number; }
interface LobbyCampersProps { campers?: Camper[]; noCard?: boolean; }

const DEFAULT_CAMPERS: Camper[] = [
  { name: 'Rohitkumar Motiani', clientName: 'Brooksource', avgBreakMin: 142 },
  { name: 'Rekha Malkani', clientName: 'Ampcus', avgBreakMin: 118 },
];

const SHAME = [
  { label: 'Lobby King',   color: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)', glow: 'rgba(239,68,68,0.15)' },
  { label: 'Couch Potato', color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.22)', glow: 'rgba(249,115,22,0.15)' },
  { label: 'Snooze Mode',  color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.20)', glow: 'rgba(167,139,250,0.15)' },
];

function Row({ camper, rank }: { camper: Camper; rank: number }) {
  const s = SHAME[rank] || SHAME[2];
  const over = camper.avgBreakMin ? Math.max(0, camper.avgBreakMin - 85) : 30;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
      borderRadius: 14, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${s.color}22 0%, ${s.color}05 100%)`,
            border: `1.5px solid ${s.color}55`,
            boxShadow: `0 0 10px ${s.glow}`,
          }}
        >
          {rank === 0 ? (
            <Flame size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
          ) : rank === 1 ? (
            <AlertTriangle size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
          ) : (
            <Hourglass size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
          )}
        </div>
        {/* Rank badge overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 14,
            height: 14,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 900,
            color: '#fff',
            background: `linear-gradient(135deg, ${s.color} 0%, #000 100%)`,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          {rank + 1}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Satoshi',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{camper.name.split(' ')[0]}</span>
          <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: s.color, fontFamily: "'Satoshi',sans-serif", flexShrink: 0 }}>{s.label}</span>
        </div>
        {camper.clientName && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', fontFamily: "'Satoshi',sans-serif" }}>{camper.clientName}</span>}
      </div>

      {/* Over-limit badge */}
      {over > 0 && (
        <div style={{
          padding: '3px 7px', borderRadius: 8, flexShrink: 0,
          fontSize: 9, fontWeight: 800, color: s.color,
          background: `${s.color}12`, border: `1px solid ${s.color}28`,
          fontFamily: "'Geist Mono',monospace",
        }}>+{over}m</div>
      )}
    </div>
  );
}

export default function LobbyCampers({ campers, noCard = false }: LobbyCampersProps) {
  const list = (campers && campers.length > 0 ? campers : DEFAULT_CAMPERS).slice(0, 3);
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.map((c, i) => <Row key={i} camper={c} rank={i} />)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 4px #EF4444', flexShrink: 0 }} />
        <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.18)', fontFamily: "'Satoshi',sans-serif", letterSpacing: '0.08em' }}>Over limit · avg daily break shown</span>
      </div>
    </div>
  );
  if (noCard) return content;
  return content;
}

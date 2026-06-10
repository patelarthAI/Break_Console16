'use client';
import React from 'react';
import { Crown, Trophy, Medal } from 'lucide-react';

interface Leader { name: string; clientName?: string; avgBreakMs?: number; }
interface AuraMaxersProps { leaders?: Leader[]; noCard?: boolean; }

const DEFAULT_LEADERS: Leader[] = [
  { name: 'Smit Solanki', clientName: 'Brooksource' },
  { name: 'Amlan Roy', clientName: 'Ampcus' },
  { name: 'Rabin Namindla', clientName: 'Brooksource' },
];

const RANKS = [
  { tier: 'Legend', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', glow: 'rgba(245,158,11,0.3)', bar: 100 },
  { tier: 'Elite',  color: '#CBD5E1', bg: 'rgba(203,213,225,0.08)', border: 'rgba(203,213,225,0.20)', glow: 'rgba(203,213,225,0.3)', bar: 76 },
  { tier: 'Pro',    color: '#D97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.20)',   glow: 'rgba(217,119,6,0.2)', bar: 55 },
];

function Card({ member, rank }: { member: Leader; rank: number }) {
  const r = RANKS[rank] || { tier: 'Ranked', color: '#6B7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.15)', glow: 'rgba(107,114,128,0.1)', bar: 30 };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
      borderRadius: 14, background: r.bg, border: `1px solid ${r.border}`,
      boxShadow: `0 0 16px ${r.color}0a`,
    }}>
      {/* Ranked Icon Component */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${r.color}22 0%, ${r.color}05 100%)`,
            border: `1.5px solid ${r.color}55`,
            boxShadow: `0 0 10px ${r.glow}`,
          }}
        >
          {rank === 0 ? (
            <Crown size={14} style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color}80)` }} />
          ) : rank === 1 ? (
            <Trophy size={14} style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color}80)` }} />
          ) : (
            <Medal size={14} style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color}80)` }} />
          )}
        </div>
      </div>

      {/* Name + meta + bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Satoshi',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{member.name}</span>
          <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: r.color, fontFamily: "'Satoshi',sans-serif", flexShrink: 0 }}>{r.tier}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {member.clientName && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: "'Satoshi',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.clientName}</span>}
          <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1, marginLeft: 'auto' }}>
            <div style={{ height: '100%', width: `${r.bar}%`, background: `linear-gradient(90deg,${r.color}60,${r.color})`, borderRadius: 1, boxShadow: `0 0 4px ${r.color}50` }} />
          </div>
        </div>
      </div>

      {/* Live dot */}
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00F5A0', boxShadow: '0 0 6px #00F5A0', flexShrink: 0, animation: 'statusPulse 2s ease-in-out infinite' }} />
    </div>
  );
}

export default function AuraMaxers({ leaders, noCard = false }: AuraMaxersProps) {
  const list = (leaders && leaders.length > 0 ? leaders : DEFAULT_LEADERS).slice(0, 3);
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.map((m, i) => <Card key={i} member={m} rank={i} />)}
    </div>
  );
  if (noCard) return content;
  return content;
}

'use client';
import React, { useState, useEffect } from 'react';
import { getAllUsersStatus } from '@/lib/store';

const STATUS_COLOR: Record<string, string> = {
  working: '#00F5A0', on_break: '#FFD700', on_brb: '#D8B4FE',
  idle: '#6B7280', offline: '#374151', punched_out: '#4B5563', on_leave: '#8B5CF6',
};
const STATUS_LABEL: Record<string, string> = {
  working: 'Working', on_break: 'On Break', on_brb: 'BRB',
  idle: 'Idle', offline: 'Offline', punched_out: 'Done', on_leave: 'Leave',
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface OnBreakCardProps { noCard?: boolean; }

export default function OnBreakCard({ noCard = false }: OnBreakCardProps) {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const data = await getAllUsersStatus();
        if (!cancelled && data?.length) {
          // Map to stable { name, status } shape
          setTeam(data.map((u: any) => ({
            name: u.user?.name || 'Team Member',
            status: u.status || 'working',
          })));
        }
      } catch (e) { console.error('OnBreakCard: failed to load team status', e); } finally { if (!cancelled) setLoading(false); }
    };
    fetch();
    const iv = setInterval(fetch, 60_000); // 60s (was 30s) — reduce Supabase egress
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const away    = team.filter(m => m.status === 'on_break' || m.status === 'on_brb');
  const working = team.filter(m => m.status === 'working').length;
  const allClear = away.length === 0;

  const statusCounts = [
    { key: 'working', label: 'Working', color: '#00F5A0', count: working },
    { key: 'on_break', label: 'Break', color: '#FFD700', count: team.filter(m => m.status === 'on_break').length },
    { key: 'on_brb', label: 'BRB', color: '#D8B4FE', count: team.filter(m => m.status === 'on_brb').length },
  ].filter(s => s.count > 0);

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', fontFamily: "'Satoshi',sans-serif" }}>
          Team Status
        </span>
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: allClear ? '#00F5A0' : '#FFD700',
              boxShadow: `0 0 6px ${allClear ? '#00F5A0' : '#FFD700'}`,
              animation: 'statusPulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 8.5, fontWeight: 700, color: allClear ? '#00F5A0' : '#FFD700', fontFamily: "'Satoshi',sans-serif" }}>
              {allClear ? 'All Working' : `${away.length} Away`}
            </span>
          </div>
        )}
      </div>

      {/* Status count bubbles */}
      {!loading && statusCounts.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {statusCounts.map(s => (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 20,
              background: `${s.color}0d`,
              border: `1px solid ${s.color}28`,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: s.color, boxShadow: `0 0 5px ${s.color}` }} />
              <span style={{ fontSize: 7.5, fontWeight: 700, color: s.color, fontFamily: "'Satoshi',sans-serif" }}>{s.count}</span>
              <span style={{ fontSize: 7, color: `${s.color}80`, fontFamily: "'Satoshi',sans-serif" }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Away members list */}
      {loading ? (
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : allClear ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(0,245,160,0.06)', border: '1px solid rgba(0,245,160,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: "'Satoshi',sans-serif" }}>Everyone is working</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {away.slice(0, 4).map((m, i) => {
            const col = STATUS_COLOR[m.status] || '#6B7280';
            const lbl = STATUS_LABEL[m.status] || m.status;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: col,
                  background: `${col}12`, border: `1px solid ${col}25`,
                  fontFamily: "'Satoshi',sans-serif",
                }}>{initials(m.name || 'TM')}</div>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: "'Satoshi',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(m.name || 'Member').split(' ')[0]}
                </span>
                <div style={{ padding: '2px 6px', borderRadius: 6, fontSize: 7, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: col, background: `${col}10`, border: `1px solid ${col}22`, flexShrink: 0, fontFamily: "'Satoshi',sans-serif" }}>
                  {lbl}
                </div>
              </div>
            );
          })}
          {away.length > 4 && (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)', paddingLeft: 31, fontFamily: "'Satoshi',sans-serif" }}>+{away.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  );

  if (noCard) return content;
  return <div style={{ padding: '14px 14px 12px' }}>{content}</div>;
}

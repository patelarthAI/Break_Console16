'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, Medal, Flame, AlertTriangle, Hourglass, AlertCircle } from 'lucide-react';
import { getAllUsersStatus, getSingleUserStatus } from '@/lib/store';
import { subscribe } from '@/lib/realtime';
import { getTodayKey } from '@/lib/timeUtils';
import { User } from '@/types';

/* ─── helpers ─────────────────────────────────────────── */
function ini(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const QUOTES = [
  { text: "Champions aren't made in the lobby. They're built at the desk.", src: "Brigade Creed" },
  { text: "Don't count the hours — make the hours count.", src: "Elite Standard" },
  { text: "Intensity of focus separates good from legendary.", src: "Brigade Command" },
  { text: "Your discipline today is your freedom tomorrow.", src: "The Brigade Way" },
  { text: "The scoreboard doesn't lie. Show up, stack time, win the day.", src: "Aura Protocol" },
  { text: "Each log you make is proof you showed up — that matters.", src: "The Pulse System" },
];
function todayQ() {
  const n = new Date(), s = new Date(n.getFullYear(), 0, 0);
  return Math.floor((n.getTime() - s.getTime()) / 86400000) % QUOTES.length;
}

/* ─── Status config ───────────────────────────────────── */
const ST: Record<string, { color: string; label: string; bg: string; borderGlow: string }> = {
  on_break: { color: '#FBBF24', label: 'BREAK', bg: 'rgba(251,191,36,0.08)', borderGlow: 'rgba(251,191,36,0.3)' },
  on_brb:   { color: '#A78BFA', label: 'BRB',   bg: 'rgba(167,139,250,0.08)', borderGlow: 'rgba(167,139,250,0.3)' },
};

/* ─── Aura rank ───────────────────────────────────────── */
const AURA = [
  { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.20)' },
  { color: '#CBD5E1', glow: 'rgba(203,213,225,0.3)', bg: 'rgba(203,213,225,0.05)', border: 'rgba(203,213,225,0.16)' },
  { color: '#D97706', glow: 'rgba(217,119,6,0.2)', bg: 'rgba(217,119,6,0.06)',   border: 'rgba(217,119,6,0.18)'  },
];

/* ─── Lobby shame ─────────────────────────────────────── */
const LOBBY = [
  { color: '#EF4444', glow: 'rgba(239,68,68,0.15)', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.20)'  },
  { color: '#F97316', glow: 'rgba(249,115,22,0.15)', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.18)' },
  { color: '#A78BFA', glow: 'rgba(167,139,250,0.15)', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.18)'},
];

/* ─── Shared premium card ─────────────────────────────── */
function PremiumCard({
  left, name, sub, right, color, bg, border,
}: {
  left: React.ReactNode;
  name: string;
  sub?: string;
  right?: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 10px', borderRadius: 14,
      background: bg, border: `1px solid ${border}`,
      position: 'relative', overflow: 'hidden',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.4)`,
    }}>
      {/* Top glow line */}
      <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:1, background:`linear-gradient(90deg,transparent,${color}40,transparent)` }} />
      {left}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11.5, fontWeight:700, color:'#fff', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>{name}</div>
        {sub && <div style={{ fontSize:10, color:'rgba(255,255,255,0.30)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", marginTop:2, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ─── Divider ─────────────────────────────────────────── */
const Div = () => (
  <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', margin:'10px 0', flexShrink:0 }} />
);

/* ─── Section label ───────────────────────────────────── */
function SL({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.20em', textTransform:'uppercase', color:'rgba(255,255,255,0.28)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", marginBottom:9 }}>
      {children}
    </div>
  );
}

/* ─── Scroll container (invisible scrollbar) ──────────── */
function ScrollBox({ children, maxH }: { children: React.ReactNode; maxH: number }) {
  return (
    <div style={{
      maxHeight: maxH, overflowY:'auto', overflowX:'hidden',
      scrollbarWidth:'none', msOverflowStyle:'none',
    }}>
      <style>{`.no-sb::-webkit-scrollbar{display:none}`}</style>
      <div className="no-sb">{children}</div>
    </div>
  );
}

/* ─── Interfaces ──────────────────────────────────────── */
interface Leader { name: string; clientName?: string; }
interface Camper { name: string; clientName?: string; avgBreakMin?: number; }
interface RightPanelProps { user: User; leaders?: Leader[]; campers?: Camper[]; }

const DEF_LEADERS: Leader[] = [];
const DEF_CAMPERS: Camper[] = [];

/* ═══════════════════════════════════════════════════════ */
export default function RightPanel({ user, leaders, campers }: RightPanelProps) {
  const [team,   setTeam]   = useState<{ id?: string; name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [qIdx,   setQIdx]   = useState(todayQ());
  const [fade,   setFade]   = useState(false);

  const clientName = user?.clientName || '';

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        /* Filter server-side by recruiter's client */
        const d = await getAllUsersStatus(clientName || undefined);
        if (!dead && d?.length) {
          setTeam(d.map((u: any) => ({
            id:     u.user?.id,
            name:   u.user?.name   || 'Team Member',
            status: u.status       || 'working',
          })));
        }
      } catch (e) { console.error('RightPanel: failed to load team status', e); } finally { if (!dead) setLoading(false); }
    };
    load();

    const todayKey = getTodayKey();
    const unsub = subscribe('time_logs', '*', async (payload?: { new?: { user_id?: string }; old?: { user_id?: string } }) => {
      const userId = payload?.new?.user_id || payload?.old?.user_id;
      if (!userId) {
        load();
        return;
      }
      try {
        const updated = await getSingleUserStatus(userId);
        if (dead || !updated) return;
        
        // If clientName filter is set, check if this user belongs to it
        if (clientName && updated.user?.clientName !== clientName) return;

        setTeam((prev) => {
          const idx = prev.findIndex((m) => m.id === userId);
          const mappedUser = {
            id:     updated.user?.id,
            name:   updated.user?.name   || 'Team Member',
            status: updated.status       || 'working',
          };
          if (idx === -1) {
            return [...prev, mappedUser];
          }
          const next = prev.slice();
          next[idx] = mappedUser;
          return next;
        });
      } catch (e) {
        console.error('RightPanel: realtime status update failed', e);
      }
    }, `date=eq.${todayKey}`);

    return () => { dead = true; unsub(); };
  }, [clientName]);

  /* Only show people who are actually away (break / BRB) */
  const away    = team.filter(m => m.status === 'on_break' || m.status === 'on_brb');
  const allClear = away.length === 0;

  const nextQ = () => {
    if (fade) return;
    setFade(true);
    setTimeout(() => { setQIdx(i => (i + 1) % QUOTES.length); setFade(false); }, 160);
  };
  const q = QUOTES[qIdx];

  const auraList = (leaders?.length  ? leaders  : DEF_LEADERS).slice(0, 3);
  const campList = (campers?.length  ? campers  : DEF_CAMPERS).slice(0, 3);

  /* ────────────────────────────────────────────────────── */
  return (
    <aside className="rp-scroll" style={{
      flex: 1, minHeight: 0,
      background:`linear-gradient(160deg,rgba(11,10,24,0.98) 0%,rgba(6,5,15,1) 100%)`,
      border:'1px solid rgba(255,255,255,0.07)',
      backdropFilter:'blur(40px)', borderRadius:20,
      overflowY:'auto', overflowX:'hidden',
      boxShadow:`0 0 0 1px rgba(255,255,255,0.02), 0 24px 64px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      <style>{`
        .rp-scroll::-webkit-scrollbar { display: none; }
        .rp-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        
        @keyframes avatarGlow {
          0%, 100% { box-shadow: 0 0 2px transparent; border-color: var(--avatar-border-dim); }
          50% { box-shadow: 0 0 8px var(--avatar-glow-glow); border-color: var(--avatar-glow); }
        }
        .avatar-pulse {
          animation: avatarGlow 2.5s ease-in-out infinite;
        }
      `}</style>
      <div style={{ padding:'14px 13px', display:'flex', flexDirection:'column', gap:0 }}>

      {/* ══ 1. TEAM STATUS ══════════════════════════════ */}
      <div style={{ flexShrink:0 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <SL>Team Status {clientName && <span style={{ color:'rgba(255,255,255,0.12)', textTransform:'none', letterSpacing:0, fontWeight:500 }}>· {clientName}</span>}</SL>
          {!loading && (
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: allClear ? '#00F5A0' : '#FBBF24', boxShadow:`0 0 6px ${allClear ? '#00F5A0' : '#FBBF24'}`, animation:'statusPulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize:8, fontWeight:700, color: allClear ? '#00F5A0' : '#FBBF24', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif" }}>
                {allClear ? 'All Clear' : `${away.length} Away`}
              </span>
            </div>
          )}
        </div>

        {/* Full list — no cutoff, parent aside scrolls */}
        <div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[0,1,2].map(i => <div key={i} style={{ height:34, borderRadius:10, background:'rgba(255,255,255,0.03)' }} />)}
            </div>
          ) : allClear ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:12, background:'rgba(0,245,160,0.05)', border:'1px solid rgba(0,245,160,0.12)' }}>
              <div style={{ width:28, height:28, borderRadius:9, background:'rgba(0,245,160,0.10)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>✓</div>
              <span style={{ fontSize:10.5, color:'rgba(0,245,160,0.6)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif" }}>All teammates working</span>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {away.map((m, i) => {
                const s = ST[m.status] || ST.on_break;
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:8,
                    padding:'7px 10px', borderRadius:14,
                    background:s.bg, border:`1px solid ${s.color}20`,
                    position:'relative', overflow:'hidden',
                  }}>
                    {/* Left status bar */}
                    <div style={{ position:'absolute', left:0, top:'16%', bottom:'16%', width:2.5, borderRadius:'0 3px 3px 0', background:s.color, boxShadow:`0 0 8px ${s.color}80` }} />
                    {/* Avatar */}
                    <div 
                      className="avatar-pulse"
                      style={{
                        width:28, height:28, borderRadius:9, flexShrink:0, marginLeft:4,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:9, fontWeight:900, color:s.color,
                        background:`${s.color}14`, border:`1px solid ${s.color}30`,
                        fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif",
                        '--avatar-glow': s.color,
                        '--avatar-glow-glow': s.borderGlow,
                        '--avatar-border-dim': `${s.color}30`,
                      } as React.CSSProperties}
                    >{ini(m.name)}</div>
                    {/* Name */}
                    <span style={{ flex:1, fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.75)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {m.name}
                    </span>
                    {/* Status chip */}
                    <div style={{
                      padding:'2px 8px', borderRadius:8, flexShrink:0,
                      fontSize:10, fontWeight:900, letterSpacing:'0.10em', textTransform:'uppercase',
                      color:s.color, background:`${s.color}12`, border:`1px solid ${s.color}25`,
                      fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif",
                    }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Div />

      {/* ══ 2. AURA MAXERS + QUOTE ═══════════════════════ */}
      <div style={{ flexShrink:0 }}>
        <SL>Aura Maxers</SL>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {auraList.map((m, i) => {
            const r = AURA[i] || AURA[2];
            const isChamp = i === 0;
            return (
              <motion.div
                key={i}
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  display:'flex', alignItems:'center', gap:9,
                  padding: isChamp ? '10px 12px' : '7px 10px',
                  borderRadius: 14,
                  background: isChamp
                    ? `linear-gradient(135deg, ${r.color}14 0%, ${r.color}05 100%)`
                    : `${r.color}06`,
                  border: `1px solid ${isChamp ? r.color+'40' : r.color+'18'}`,
                  borderTop: `1px solid ${isChamp ? r.color+'60' : r.color+'25'}`,
                  boxShadow: isChamp
                    ? `0 0 28px ${r.color}14, 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)`
                    : '0 2px 8px rgba(0,0,0,0.3)',
                  position:'relative', overflow:'hidden',
                  cursor: 'default',
                }}
              >
                {isChamp && <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:`linear-gradient(90deg,transparent,${r.color}80,transparent)`, boxShadow:`0 0 8px ${r.color}60` }} />}
                
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
                      transition: 'all 0.5s ease',
                    }}
                  >
                    {i === 0 ? (
                      <Crown size={14} style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color}80)` }} />
                    ) : i === 1 ? (
                      <Trophy size={14} style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color}80)` }} />
                    ) : (
                      <Medal size={14} style={{ color: r.color, filter: `drop-shadow(0 0 4px ${r.color}80)` }} />
                    )}
                  </div>
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize: isChamp ? 12.5 : 11, fontWeight: isChamp ? 800 : 600, color: isChamp ? '#fff' : 'rgba(255,255,255,0.75)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>{m.name}</div>
                  {m.clientName && <div style={{ fontSize:10, color:`${r.color}65`, fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", marginTop:2, lineHeight:1 }}>{m.clientName}</div>}
                </div>
                {isChamp && <div style={{ width:6, height:6, borderRadius:'50%', background:r.color, boxShadow:`0 0 8px ${r.color}`, flexShrink:0, animation:'statusPulse 2s ease-in-out infinite' }} />}
              </motion.div>
            );
          })}
        </div>

        {/* Inline quote */}
        <div style={{
          marginTop:10, padding:'9px 11px', borderRadius:12,
          background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.09)',
          cursor:'pointer',
          opacity: fade ? 0 : 1, transform: fade ? 'translateY(3px)' : 'none',
          transition:'opacity 150ms ease, transform 150ms ease',
        }} onClick={nextQ}>
          <div style={{ display:'flex', gap:6 }}>
            <span style={{ fontSize:18, color:'#F59E0B', opacity:0.25, lineHeight:0.85, fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", flexShrink:0 }}>"</span>
            <div>
              <p style={{ fontSize:10, lineHeight:1.6, color:'rgba(240,240,240,0.48)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", fontStyle:'italic', margin:0 }}>{q.text}</p>
              <span style={{ fontSize:7, color:'rgba(245,158,11,0.4)', fontFamily:"'Satoshi', system-ui, -apple-system, sans-serif", letterSpacing:'0.12em', textTransform:'uppercase', marginTop:4, display:'block' }}>— {q.src}</span>
            </div>
          </div>
        </div>
      </div>

      <Div />

      {/* ══ 3. LOBBY CAMPERS ════════════════════════════ */}
      <div style={{ flexShrink:0 }}>
        <SL>Lobby Campers</SL>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {campList.map((c, i) => {
            const s = LOBBY[i] || LOBBY[2];
            const leftIcon = (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `linear-gradient(135deg, ${s.color}22 0%, ${s.color}05 100%)`,
                    border: `1.5px solid ${s.color}55`,
                    boxShadow: `0 0 10px ${s.glow}`,
                  }}
                >
                  {i === 0 ? (
                    <Flame size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
                  ) : i === 1 ? (
                    <AlertTriangle size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
                  ) : i === 2 ? (
                    <Hourglass size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color}80)` }} />
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
                  {i + 1}
                </div>
              </div>
            );

            return (
              <motion.div
                key={i}
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <PremiumCard
                  color={s.color} bg={s.bg} border={s.border}
                  name={c.name} sub={c.clientName}
                  left={leftIcon}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      </div>{/* end inner padding wrapper */}
    </aside>
  );
}

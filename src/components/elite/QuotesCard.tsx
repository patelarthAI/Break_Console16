'use client';
import React, { useState, useEffect } from 'react';

const QUOTES = [
  { text: "Excellence is not a skill — it's an attitude forged daily in the details.", src: "The Brigade Code" },
  { text: "Every minute of focus is a deposit in the bank of extraordinary results.", src: "Breakthrough Doctrine" },
  { text: "Champions aren't made in the lobby. They're built at the desk.", src: "Brigade Creed" },
  { text: "The scoreboard doesn't lie. Show up, stack time, win the day.", src: "Aura Maxer Protocol" },
  { text: "Your discipline today is your freedom tomorrow.", src: "The Brigade Way" },
  { text: "Don't count the hours — make the hours count.", src: "Elite Standard" },
  { text: "Intensity of focus separates good from legendary.", src: "Brigade Command" },
  { text: "Each log you make is proof you showed up — that matters.", src: "The Pulse System" },
];

function todayIndex() {
  const n = new Date(), s = new Date(n.getFullYear(),0,0);
  return Math.floor((n.getTime()-s.getTime())/(1000*60*60*24)) % QUOTES.length;
}

interface QuotesCardProps { noCard?: boolean; }

export default function QuotesCard({ noCard = false }: QuotesCardProps) {
  const [idx, setIdx] = useState(todayIndex());
  const [fading, setFading] = useState(false);

  const next = () => {
    if (fading) return;
    setFading(true);
    setTimeout(() => { setIdx(i => (i+1) % QUOTES.length); setFading(false); }, 180);
  };

  const q = QUOTES[idx];

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" style={{ filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.5))' }}>
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', fontFamily: "'Satoshi',sans-serif" }}>Daily Brief</span>
        </div>
        <button onClick={next} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
          borderRadius: 8, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.2)', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Quote */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        opacity: fading ? 0 : 1, transform: fading ? 'translateY(4px)' : 'none',
        transition: 'opacity 160ms ease, transform 160ms ease',
      }}>
        {/* Quote mark */}
        <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B', opacity: 0.2, lineHeight: 0.8, fontFamily: 'Georgia, serif' }}>"</div>
        <p style={{ fontSize: 12, lineHeight: 1.65, color: 'rgba(240,240,240,0.62)', fontFamily: "'Satoshi',sans-serif", fontWeight: 500 }}>{q.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: 16, height: 1.5, borderRadius: 1, background: '#F59E0B', opacity: 0.5 }} />
          <span style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Satoshi',sans-serif" }}>{q.src}</span>
        </div>
      </div>

      {/* Progress — simple fraction, no dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
          <div style={{ height: '100%', width: `${((idx+1)/QUOTES.length)*100}%`, background: 'linear-gradient(90deg,#F59E0B60,#F59E0B)', borderRadius: 1, transition: 'width 0.4s ease' }} />
        </div>
        <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.18)', fontFamily: "'Geist Mono',monospace", flexShrink: 0 }}>{idx+1}/{QUOTES.length}</span>
      </div>
    </div>
  );

  if (noCard) return content;
  return content;
}

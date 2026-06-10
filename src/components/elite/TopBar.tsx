'use client';
import React from 'react';
import { User } from '@/types';
import { LogOut } from 'lucide-react';

interface TopBarProps { user: User; onLogout: () => void; }

export default function TopBar({ user, onLogout }: TopBarProps) {
  const userName   = user?.name       || 'Recruiter';
  const clientName = user?.clientName || '';
  const initials   = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header style={{
      height: 52,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      background: 'rgba(6,5,14,0.88)',
      backdropFilter: 'blur(48px) saturate(180%)',
      WebkitBackdropFilter: 'blur(48px) saturate(180%)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      position: 'sticky', top: 0, zIndex: 50,
      userSelect: 'none',
      flexShrink: 0,
    }}>

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/logo.png" alt="Breakthrough Brigade"
          style={{ width: 26, height: 26, objectFit: 'contain', opacity: 0.9 }} />
        <span style={{
          fontSize: '0.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)',
          letterSpacing: '-0.01em',
          fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
        }}>Breakthrough Brigade</span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 20,
          background: 'rgba(0,245,160,0.06)',
          border: '1px solid rgba(0,245,160,0.16)',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: '#00f5a0',
            boxShadow: '0 0 6px #00f5a0', display: 'inline-block',
            animation: 'statusPulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.18em', color: '#00f5a0', fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif" }}>LIVE</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px 4px 4px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9.5, fontWeight: 900, color: '#fff',
            boxShadow: '0 0 10px rgba(168,85,247,0.3)',
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2, fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif" }}>{userName}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif" }}>{clientName}</div>
          </div>
        </div>

        <button onClick={onLogout} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.2)', padding: 4, display: 'flex',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; }}>
          <LogOut size={14} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

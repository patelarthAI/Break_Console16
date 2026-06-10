'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, BarChart3, Calendar, Settings, LogOut } from 'lucide-react';
import type { User } from '@/types';

interface AdminNavbarProps {
  user: User;
  activeView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

const NAV_TABS = [
  { id: 'dashboard', label: 'Live Dashboard', icon: LayoutDashboard },
  { id: 'reports',   label: 'Reports',        icon: BarChart3 },
  { id: 'leave',     label: 'Leave Desk',     icon: Calendar },
  { id: 'settings',  label: 'Settings',       icon: Settings },
];

export default function AdminNavbar({ user, activeView, onViewChange, onLogout }: AdminNavbarProps) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const date = new Date();
      setTimeStr(date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(6,7,10,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        height: '56px',
        maxWidth: '1800px',
        margin: '0 auto',
      }}>

        {/* ── Left: Brand ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Brigade Pulse Logo */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 16px rgba(99,102,241,0.15)',
          }}>
            <img 
              src="/logo.png" 
              alt="Brigade Pulse"
              style={{ 
                width: '24px', 
                height: '24px', 
                objectFit: 'contain', 
                opacity: 0.95,
                filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.5))',
              }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{
              fontSize: '15px',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.03em',
              fontFamily: 'var(--f-display)',
            }}>
              Brigade Pulse
            </span>
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              Admin Unit
              {user.isMaster && (
                <span style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                  display: 'inline-block',
                  animation: 'pulse 2s cubic-bezier(.4,0,.6,1) infinite',
                }} />
              )}
            </span>
          </div>
        </div>

        {/* ── Center: Nav Tabs ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '14px',
          padding: '4px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {NAV_TABS.map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onViewChange(tab.id)}
                style={{
                  position: 'relative',
                  padding: '7px 18px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isActive ? '#fff' : '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#64748b'; }}
              >
                {isActive && (
                  <>
                    <motion.div
                      layoutId="nav-active-pill"
                      className="hotstar-border-glow"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                      }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    />
                    <motion.div
                      layoutId="nav-active-line"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '20%',
                        right: '20%',
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, #ff007a, #7928ca, #3b82f6, #00f5a0, transparent)',
                        backgroundSize: '200% auto',
                        animation: 'hotstarChroma 5s linear infinite',
                        boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
                      }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    />
                  </>
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Right: Chronos + Logout ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
            <span style={{
              fontSize: '8px',
              fontWeight: 900,
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              marginBottom: '2px',
              textShadow: '0 0 8px rgba(99,102,241,0.25)',
            }}>
              Chronos
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              color: '#ffffff',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.02em',
            }}>
              {timeStr || '00:00:00 AM'}
            </span>
            <span style={{
              fontSize: '9px',
              fontWeight: 600,
              color: '#64748b',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.02em',
              marginTop: '1px',
            }}>
              {todayLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 16px',
              borderRadius: '10px',
              background: '#0d0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f8fafc',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1a1c2b';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0d0e14';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            Terminal Out
            <LogOut size={13} />
          </button>
        </div>

      </div>
    </nav>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockKeyhole, UserRound, Eye, EyeOff,
  ChevronDown, Loader2, Briefcase, ShieldCheck, Zap,
} from 'lucide-react';
import { getUserByNameAndClient, upsertUser, setCurrentUser } from '@/lib/store';
import { generateUUID } from '@/lib/timeUtils';

function SpotlightWrapper({ children }: { children: React.ReactNode }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="spotlight-container"
    >
      {children}
    </div>
  );
}

export default function AuthModal({ onLogin }: { onLogin: (user: any) => void }) {
  const [mounted, setMounted]           = useState(false);
  const [name, setName]                 = useState('');
  const [password, setPassword]         = useState('');
  const [client, setClient]             = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });

  const clientOptions = [
    'Bench', 'Brooksource', 'FPG', 'Guardian Healthstaff',
    'Hiretalent', 'HPP Staffing', 'Manpower Canada', 'Synergis',
  ];

  const isCaptainName  = name.trim().toLowerCase() === 'captain';
  const requiresClient = !isCaptainName;

  const handleButtonMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    const pullX = (x / (rect.width / 2)) * 8;
    const pullY = (y / (rect.height / 2)) * 8;
    setButtonOffset({ x: pullX, y: pullY });
  };
  const handleButtonMouseLeave = () => {
    setButtonOffset({ x: 0, y: 0 });
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (isCaptainName) setClient(''); }, [isCaptainName]);

  const handleLogin = async () => {
    const n = name.trim();
    if (!n)                         { setError('Please enter your name'); return; }
    if (requiresClient && !client)  { setError('Please select your client'); return; }
    if (!password)                  { setError('Please enter your password'); return; }

    setLoading(true);
    setError(null);
    try {
      const clientForLookup = isCaptainName ? 'General' : client;
      const existingUser    = await getUserByNameAndClient(n, clientForLookup);
      if (existingUser) {
        const requiredPass = existingUser.isMaster ? '1234' : '123';
        if (password !== requiredPass) { setError('Incorrect password'); setLoading(false); return; }
        setCurrentUser(existingUser);
        onLogin(existingUser);
        return;
      }
      if (password !== '123') {
        setError('Name or client not recognized. Use password 123 to request access.');
        setLoading(false);
        return;
      }
      const newUser = {
        id: generateUUID(), name: n, clientName: client || 'General',
        isMaster: false, isApproved: false,
        shiftStart: '08:00', shiftEnd: '17:00',
        timezone: 'America/Chicago', workMode: 'WFO' as const,
      };
      const savedUser = await upsertUser(newUser);
      setCurrentUser(savedUser);
      onLogin(savedUser);
    } catch (err: any) {
      setError(err.message || 'System connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: 'transparent', fontFamily: "'Satoshi', Inter, system-ui, sans-serif" }}
    >
      <style>{`
        /* Colour-changing shimmer button — indigo → violet → pink → violet → indigo */
        @keyframes colour-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .btn-colour-shift {
          background: linear-gradient(270deg, #4f46e5, #7c3aed, #a855f7, #ec4899, #a855f7, #7c3aed, #4f46e5);
          background-size: 400% 400%;
          animation: colour-shift 5s ease infinite;
          border: none;
          box-shadow: 0 0 28px rgba(168,85,247,0.45), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .btn-colour-shift:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 0 48px rgba(168,85,247,0.65), 0 0 20px rgba(236,72,153,0.35), 0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .btn-colour-shift:active { transform: scale(0.97); }
        /* Input 3D with Dynamic Multicolour Border Shift */
        @keyframes input-border-glow {
          0% {
            border-color: rgba(168, 85, 247, 0.35) !important;
            border-top-color: rgba(168, 85, 247, 0.55) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05), 0 0 10px rgba(168, 85, 247, 0.08) !important;
          }
          33% {
            border-color: rgba(59, 130, 246, 0.35) !important;
            border-top-color: rgba(59, 130, 246, 0.55) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05), 0 0 10px rgba(59, 130, 246, 0.08) !important;
          }
          66% {
            border-color: rgba(236, 72, 153, 0.35) !important;
            border-top-color: rgba(236, 72, 153, 0.55) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05), 0 0 10px rgba(236, 72, 153, 0.08) !important;
          }
          100% {
            border-color: rgba(168, 85, 247, 0.35) !important;
            border-top-color: rgba(168, 85, 247, 0.55) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05), 0 0 10px rgba(168, 85, 247, 0.08) !important;
          }
        }
        @keyframes input-focus-glow {
          0% {
            border-color: rgba(168, 85, 247, 0.75) !important;
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4), 0 0 0 3px rgba(168, 85, 247, 0.15) !important;
          }
          33% {
            border-color: rgba(59, 130, 246, 0.75) !important;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.4), 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
          }
          66% {
            border-color: rgba(236, 72, 153, 0.75) !important;
            box-shadow: 0 0 20px rgba(236, 72, 153, 0.4), 0 0 0 3px rgba(236, 72, 153, 0.15) !important;
          }
          100% {
            border-color: rgba(168, 85, 247, 0.75) !important;
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4), 0 0 0 3px rgba(168, 85, 247, 0.15) !important;
          }
        }
        .input-3d {
          background: rgba(255, 255, 255, 0.015) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-top: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 14px !important;
          color: #fff !important;
          transition: all 0.22s !important;
        }
        .input-multicolour {
          animation: input-border-glow 6s linear infinite !important;
        }
        .input-3d:focus {
          animation: input-focus-glow 6s linear infinite !important;
          background: rgba(255, 255, 255, 0.03) !important;
          outline: none !important;
        }
        /* Ambient Aurora Glow (Extremely faint to preserve stars) */
        @keyframes ambient-glow {
          0% {
            background: radial-gradient(circle at center, rgba(168, 85, 247, 0.12) 0%, transparent 65%);
          }
          33% {
            background: radial-gradient(circle at center, rgba(59, 130, 246, 0.12) 0%, transparent 65%);
          }
          66% {
            background: radial-gradient(circle at center, rgba(236, 72, 153, 0.12) 0%, transparent 65%);
          }
          100% {
            background: radial-gradient(circle at center, rgba(168, 85, 247, 0.12) 0%, transparent 65%);
          }
        }
        .ambient-aurora {
          position: absolute;
          inset: -60px;
          border-radius: 50%;
          filter: blur(50px);
          animation: ambient-glow 10s ease-in-out infinite;
          z-index: -1;
          pointer-events: none;
        }
        /* Scrollbar */
        .drop-scroll::-webkit-scrollbar { width: 4px; }
        .drop-scroll::-webkit-scrollbar-track { background: transparent; }
        .drop-scroll::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.25); border-radius: 4px; }
        /* Autofill - block light blue background by overlaying a dark space-themed shadow */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #06040a inset, 0 4px 12px rgba(0,0,0,0.1) !important;
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff !important;
          transition: background-color 999999s ease-in-out 0s;
        }
        /* Responsive login layout alignment to bridge gap with solar system */
        .login-layout-wrapper {
          position: absolute; inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          pointer-events: none;
        }
        .desktop-spacer {
          display: none;
        }
        .spotlight-container {
          position: relative;
          border-radius: 14px;
          width: 100%;
        }
        .spotlight-container::before {
          content: '';
          position: absolute;
          inset: 0px;
          border-radius: 14px;
          background: radial-gradient(
            120px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
            rgba(168, 85, 247, 0.4) 0%,
            rgba(59, 130, 246, 0.25) 50%,
            transparent 100%
          );
          pointer-events: none;
          z-index: 10;
          padding: 1.5px;
          WebkitMask: 
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0);
          WebkitMaskComposite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .spotlight-container:hover::before {
          opacity: 1;
        }
        @media (min-width: 1024px) {
          .login-layout-wrapper {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            padding: 0 5vw;
            align-items: center;
            justify-content: stretch;
          }
          .desktop-spacer {
            display: block !important;
            pointer-events: none;
          }
        }
      `}</style>

      {/* No orbs here — the NASAClock canvas behind provides the full space background */}

      {/* ── Right-aligned form ── */}
      <div className="login-layout-wrapper">
        {/* Left column spacer — only visible on desktop to center form in right column */}
        <div className="desktop-spacer" />
        
        <motion.div
          style={{ width: '100%', maxWidth: 400, pointerEvents: 'auto', justifySelf: 'center' }}
          initial={{ opacity: 0, y: 28, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Card — completely clear container with no border or solid bg */}
          <div style={{
            padding: '2.5rem 2.25rem 2rem',
            borderRadius: 28,
            background: 'transparent',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: 'none',
            boxShadow: 'none',
            position: 'relative',
          }}>
            {/* Ambient breathing color aurora */}
            <div className="ambient-aurora" />

            {/* ── Header ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', gap: '0.875rem' }}>
              <motion.div
                style={{ width: 72, height: 72, position: 'relative' }}
                initial={{ opacity: 0, y: -16, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Logo halo */}
                <div style={{
                  position: 'absolute', inset: -12, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)',
                  filter: 'blur(12px)',
                  animation: 'glow-breathe 4s ease-in-out infinite',
                }} />
                <img
                  src="/logo.png" alt="Brigade Pulse"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 8px 24px rgba(168,85,247,0.3))' }}
                />
              </motion.div>

              <motion.div style={{ textAlign: 'center' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18, duration: 0.4 }}>
                <h1 style={{
                  fontSize: '1.875rem', fontWeight: 900, color: '#fff',
                  letterSpacing: '-0.03em', lineHeight: 1,
                  marginBottom: '0.5rem',
                  fontFamily: "var(--font-sans)",
                }}>Brigade Pulse</h1>
                <p style={{
                  fontSize: '0.6rem', fontWeight: 700,
                  letterSpacing: '0.38em', textTransform: 'uppercase',
                  background: 'linear-gradient(90deg, rgba(168,85,247,0.7), rgba(192,132,252,0.95), rgba(168,85,247,0.65))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Presence Creates Momentum</p>
              </motion.div>
            </div>

            {/* ── Form ── */}
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
            >
              {/* Name */}
              <motion.div
                style={{ position: 'relative' }}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.26, duration: 0.4 }}
              >
                <SpotlightWrapper>
                  <div style={{
                    position: 'absolute', left: '0.875rem', top: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 2,
                    color: 'rgba(255,255,255,0.4)',
                  }}>
                    <UserRound size={16} strokeWidth={2} />
                  </div>
                  <input
                    type="text" placeholder="Full Name"
                    value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus
                    className="input-3d input-multicolour"
                    style={{
                      width: '100%', padding: '0.875rem 1rem 0.875rem 2.75rem',
                      fontSize: '0.9rem', outline: 'none',
                      backdropFilter: 'blur(8px)',
                      fontFamily: 'inherit',
                    }}
                  />
                </SpotlightWrapper>
                <AnimatePresence>
                  {isCaptainName && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      style={{
                        position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.6rem', borderRadius: 20,
                        background: 'rgba(168,85,247,0.12)',
                        border: '1px solid rgba(168,85,247,0.3)',
                      }}
                    >
                      <ShieldCheck size={10} style={{ color: '#a855f7' }} />
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#a855f7', textTransform: 'uppercase' }}>Captain</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Client */}
              <AnimatePresence>
                {requiresClient && (
                  <motion.div
                    key="client"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    style={{ position: 'relative', overflow: 'visible' }}
                  >
                    <SpotlightWrapper>
                      <div style={{
                        position: 'absolute', left: '0.875rem', top: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 2,
                        color: isDropdownOpen ? '#a855f7' : 'rgba(255,255,255,0.4)',
                        transition: 'color 0.2s',
                      }}>
                        <Briefcase size={16} strokeWidth={2} />
                      </div>
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="input-3d input-multicolour"
                        style={{
                          width: '100%', padding: '0.875rem 2.5rem 0.875rem 2.75rem',
                          borderRadius: 14,
                          color: client ? '#fff' : 'rgba(255,255,255,0.35)',
                          fontSize: '0.9375rem', cursor: 'pointer',
                          transition: 'all 0.22s', userSelect: 'none',
                          fontFamily: 'inherit',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        {client || <span>Select client <span style={{ color: 'rgba(239,68,68,0.7)', marginLeft: 2 }}>*</span></span>}
                      </div>
                    </SpotlightWrapper>
                    <div style={{
                      position: 'absolute', right: '1rem', top: '50%',
                      transform: `translateY(-50%) rotate(${isDropdownOpen ? 180 : 0}deg)`,
                      pointerEvents: 'none',
                      color: isDropdownOpen ? '#a855f7' : 'rgba(255,255,255,0.3)',
                      transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                    }}>
                      <ChevronDown size={15} />
                    </div>
                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.97 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="drop-scroll input-multicolour"
                          style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                            background: 'rgba(8, 5, 18, 0.65)',
                            backdropFilter: 'blur(20px) saturate(180%)',
                            borderRadius: 14,
                            padding: '0.35rem',
                            maxHeight: 210, overflowY: 'auto',
                            zIndex: 50,
                          }}
                        >
                          {clientOptions.map(opt => (
                            <div key={opt}
                              onClick={() => { setClient(opt); setIsDropdownOpen(false); }}
                              style={{
                                padding: '0.625rem 0.875rem', borderRadius: 10,
                                cursor: 'pointer', fontSize: '0.875rem',
                                color: client === opt ? '#fff' : 'rgba(255,255,255,0.5)',
                                background: client === opt ? 'rgba(168,85,247,0.15)' : 'transparent',
                                fontWeight: client === opt ? 600 : 400,
                                display: 'flex', alignItems: 'center', gap: 8,
                                transition: 'all 0.14s', fontFamily: 'inherit',
                              }}
                              onMouseEnter={e => { if (client !== opt) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}}
                              onMouseLeave={e => { if (client !== opt) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}}
                            >
                              {client === opt && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />}
                              {opt}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password */}
              <motion.div
                style={{ position: 'relative' }}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.34, duration: 0.4 }}
              >
                <SpotlightWrapper>
                  <div style={{
                    position: 'absolute', left: '0.875rem', top: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 2,
                    color: 'rgba(255,255,255,0.4)',
                  }}>
                    <LockKeyhole size={16} strokeWidth={2} />
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'} placeholder="Password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="input-3d input-multicolour"
                    style={{
                      width: '100%', padding: '0.875rem 2.75rem 0.875rem 2.75rem',
                      fontSize: '0.9rem', outline: 'none',
                      backdropFilter: 'blur(8px)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button" aria-label={showPass ? 'Hide' : 'Show'}
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', zIndex: 2,
                      color: 'rgba(255,255,255,0.3)', padding: 4, transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </SpotlightWrapper>
              </motion.div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    style={{
                      padding: '0.7rem 1rem', borderRadius: 12,
                      background: 'rgba(239,68,68,0.07)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', fontSize: '0.75rem',
                      fontWeight: 500, textAlign: 'center', lineHeight: 1.5,
                    }}
                  >{error}</motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit" disabled={loading}
                className="btn-colour-shift"
                style={{
                  width: '100%', padding: '1.0625rem',
                  borderRadius: 14, color: '#fff',
                  fontWeight: 800, fontSize: '0.7rem',
                  textTransform: 'uppercase', letterSpacing: '0.22em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                  marginTop: '0.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  position: 'relative', overflow: 'hidden',
                }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.4 }}
                whileHover={!loading ? { scale: 1.015 } : {}}
                whileTap={!loading ? { scale: 0.975 } : {}}
                onMouseMove={!loading ? handleButtonMouseMove : undefined}
                onMouseLeave={!loading ? handleButtonMouseLeave : undefined}
              >
                {/* Inner shimmer sweep */}
                {!loading && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.08) 50%, transparent 65%)',
                    backgroundSize: '200% 100%',
                    animation: 'luminous-sweep 3.5s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}
                <motion.span 
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                  animate={{ x: buttonOffset.x, y: buttonOffset.y }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                >
                  {loading
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Verifying...</>
                    : <><Zap size={13} strokeWidth={2.5} />Initialize Access</>
                  }
                </motion.span>
              </motion.button>

              {!requiresClient && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
                  style={{ textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.18)', lineHeight: 1.6 }}
                >
                  Authorized personnel only.
                </motion.p>
              )}
            </form>

            {/* Footer inside card */}
            <motion.p
              style={{
                textAlign: 'center', marginTop: '1.5rem',
                fontSize: '0.575rem', fontWeight: 700,
                color: 'rgba(255,255,255,0.1)',
                textTransform: 'uppercase', letterSpacing: '0.32em',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}
            >
              Arth Console 2026
            </motion.p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

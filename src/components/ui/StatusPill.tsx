import { displayStatus, PILL_THEME } from '@/lib/statusMap';

interface StatusPillProps {
  raw: string | null | undefined;
}

// Enhanced per-status backgrounds that override the generic theme
const PILL_BG: Record<string, { bg: string; border: string; glow: string }> = {
  'Working':    { bg: 'rgba(198,241,53,0.1)',  border: 'rgba(198,241,53,0.25)',  glow: 'rgba(198,241,53,0.15)' },
  'On Break':   { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  glow: 'rgba(245,158,11,0.15)' },
  'BRB':        { bg: 'rgba(124,92,191,0.12)', border: 'rgba(124,92,191,0.3)',   glow: 'rgba(124,92,191,0.15)' },
  'On Leave':   { bg: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.25)',  glow: 'rgba(20,184,166,0.12)' },
  'Clocked Out':{ bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.18)',   glow: 'transparent' },
  'Offline':    { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.15)', glow: 'transparent' },
};

const IS_ACTIVE = ['Working', 'On Break', 'BRB', 'On Leave'];

export function StatusPill({ raw }: StatusPillProps) {
  const label = displayStatus(raw);
  const theme = PILL_THEME[label] ?? PILL_THEME['Clocked Out'];
  const pill  = PILL_BG[label]   ?? PILL_BG['Clocked Out'];
  const active = IS_ACTIVE.includes(label);

  return (
    <div style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '6px',
      padding:      '4px 10px',
      borderRadius: '7px',
      background:   pill.bg,
      border:       `1px solid ${pill.border}`,
      width:        'fit-content',
      userSelect:   'none',
      boxShadow:    active ? `0 0 12px ${pill.glow}` : 'none',
      transition:   'all 0.2s ease',
    }}>
      {/* Dot */}
      <div style={{
        width:        '5px',
        height:       '5px',
        borderRadius: '50%',
        background:   theme.dot,
        flexShrink:   0,
        boxShadow:    active ? `0 0 6px ${theme.dot}` : 'none',
        animation:    label === 'Working' ? 'dotPulse 2s ease-in-out infinite' : 'none',
      }} />

      {/* Label */}
      <span style={{
        fontSize:      '9.5px',
        fontWeight:    800,
        color:         theme.text,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily:    'var(--f-mono)',
        whiteSpace:    'nowrap',
        opacity:       label === 'Clocked Out' || label === 'Offline' ? 0.6 : 1,
      }}>
        {label}
      </span>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(198,241,53,0.6); }
          50%       { box-shadow: 0 0 0 3px rgba(198,241,53,0); }
        }
      `}</style>
    </div>
  );
}

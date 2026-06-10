// src/lib/statusMap.ts

export const displayStatus = (raw: string | null | undefined): string => {
  if (!raw) return 'AWOL'
  const r = String(raw).toLowerCase().trim()
  
  if (r === 'working' || r === 'active' || r === 'signal_standby' || r === 'protocol_standby') return 'ACTIVE'
  if (r === 'on break' || r === 'on_break' || r === 'break' || r === 'signal_break' || r === 'protocol_break') return 'PAUSE'
  if (r === 'bnb' || r === 'be_right_back' || r === 'brb' || r === 'signal_brb' || r === 'protocol_brb' || r === 'on_brb') return 'STANDBY'
  if (r === 'on leave' || r === 'on_leave' || r === 'leave' || r === 'signal_leave' || r === 'protocol_leave') return 'OFF-SITE'
  if (r === 'idle' || r === 'offline' || r === 'signal_offline' || r === 'protocol_offline') return 'AWOL'
  if (r === 'punched_out' || r === 'clocked_out' || r === 'logged_out' || r === 'auto_logout') return 'AWOL'
  
  return 'AWOL'
}

export const STATUS_COUNTS = (reps: any[]) => {
  const safe = Array.isArray(reps) ? reps : []
  const counts = {
    'all': safe.length,
    'working': 0,
    'onBreak': 0,
    'brb': 0,
    'onLeave': 0,
    'clockedOut': 0,
    'offline': 0
  }
  
  safe.forEach(r => {
    // Robust raw status extraction
    const raw = r?.status || r?.protocol || r?.signal
    const status = displayStatus(raw)
    
    if (status === 'ACTIVE') counts.working++
    else if (status === 'PAUSE') counts.onBreak++
    else if (status === 'STANDBY') counts.brb++
    else if (status === 'OFF-SITE') counts.onLeave++
    else if (status === 'AWOL') counts.offline++
    else counts.clockedOut++
  })

  return counts
}

export const STATUS_COLOR: Record<string, string> = {
  'ACTIVE':      '#22C55E',
  'PAUSE':       '#F97316',
  'STANDBY':     '#A855F7',
  'OFF-SITE':    '#38BDF8',
  'AWOL':        '#64748B', 
}

export const STATUS_RGB: Record<string, string> = {
  'ACTIVE':      '34,197,94',
  'PAUSE':       '249,115,22',
  'STANDBY':     '168,85,247',
  'OFF-SITE':    '56,189,248',
  'AWOL':        '100,116,139',
}

export const STATUS_BORDER: Record<string, string> = {
  'ACTIVE':      '#22C55E',
  'PAUSE':       '#F97316',
  'STANDBY':     '#A855F7',
  'OFF-SITE':    '#38BDF8',
  'AWOL':        '#1E293B',
}

export const STATUS_BG_TINT: Record<string, string> = {
  'ACTIVE':      'rgba(34,197,94,0.04)',
  'PAUSE':       'rgba(249,115,22,0.04)',
  'STANDBY':     'rgba(168,85,247,0.02)',
  'OFF-SITE':    'rgba(56,189,248,0.02)',
  'AWOL':        '#0F172A',
}

export const PILL_THEME: Record<string, { bg: string, text: string, dot: string }> = {
  'ACTIVE':      { bg: 'rgba(34,197,94,0.15)', text: '#22C55E', dot: '#22C55E' },
  'PAUSE':       { bg: 'rgba(249,115,22,0.15)', text: '#F97316', dot: '#F97316' },
  'STANDBY':     { bg: 'rgba(168,85,247,0.15)', text: '#A855F7', dot: '#A855F7' },
  'OFF-SITE':    { bg: 'rgba(56,189,248,0.15)', text: '#38BDF8', dot: '#38BDF8' },
  'AWOL':        { bg: '#1E293B', text: '#64748B', dot: '#334155' },
}

export const toTitleCase = (str: string | null | undefined) => {
  if (!str) return ''
  return str.replace(/\w\S*/g, txt => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

// FIX 3 — Client colors updated to exact hex values
export const CLIENT_COLORS: Record<string, {color:string;rgb:string}> = {
  'BENCH':                {color:'#06B6D4',rgb:'6,182,212'},
  'BROOKSOURCE':          {color:'#7C3AED',rgb:'124,58,237'},
  'FPG':                  {color:'#EC4899',rgb:'236,72,153'},
  'GUARDIAN HEALTHSTAFF': {color:'#10B981',rgb:'16,185,129'},
  'HPP STAFFING':         {color:'#F59E0B',rgb:'245,158,11'},
  'MANPOWER CANADA':      {color:'#EF4444',rgb:'239,68,68'},
  'SYNERGIS':             {color:'#84CC16',rgb:'132,204,22'},
  'OPERATIONAL HUB':      {color:'#8B5CF6',rgb:'139,92,246'},
}

export const getAvatarColor = (clientName: string) => {
  const clean = clientName?.trim().toUpperCase() || 'OPERATIONAL HUB'
  return CLIENT_COLORS[clean] || CLIENT_COLORS['OPERATIONAL HUB']
}

export const CLIENT_SHORT: Record<string, string> = {
  'GUARDIAN HEALTHSTAFF':'GHS','MANPOWER CANADA':'MPC',
  'HPP STAFFING':'HPP','BROOKSOURCE':'BKS','HIRETALENT':'HIR',
  'SYNERGIS':'SYN','BENCH':'BNC','FPG':'FPG',
}

export type EventType =
  | 'punch_in'
  | 'punch_out'
  | 'break_start'
  | 'break_end'
  | 'brb_start'
  | 'brb_end';

export interface TimeLog {
  id: string;
  eventType: EventType;
  timestamp: number;
  date: string;
  addedBy?: string;
}

export interface User {
  id: string;
  name: string;
  clientName: string;   // replaces email — groups users by client
  isMaster: boolean;
  isApproved: boolean;  // must be approved by master before accessing app
  shiftStart: string;   // HH:MM in 24h, e.g. "08:00"
  shiftEnd: string;     // HH:MM in 24h, e.g. "17:00"
  timezone: string;     // IANA timezone, e.g. "America/Chicago"
}

export type AppStatus = 'idle' | 'working' | 'on_break' | 'on_brb' | 'punched_out' | 'on_leave';

export interface BreakRecord { start: number; end?: number; }
export interface BRBRecord { start: number; end?: number; }

export interface DaySession {
  punchIn?: number;
  punchOut?: number;
  breaks: BreakRecord[];
  brbs: BRBRecord[];
  logs: TimeLog[];
}

export interface LeaveRecord {
  id: string;
  date: string;
  client_name: string;
  employee_name: string;
  is_planned: boolean;
  reason: string | null;
  approver: string | null;
  leave_type: string;
  day_count: number;
  created_at?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  createdBy: string | null;
  createdAt: string;
  isActive: boolean;
}

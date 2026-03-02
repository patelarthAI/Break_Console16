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

import { supabase, UserRow, LogRow } from './supabase';
import { User, TimeLog, AppStatus, LeaveRecord, AppNotification } from '@/types';
import { getTodayKey, generateUUID, getPastDaysZoned, getElapsedWeekdays, checkViolations, toZonedMinutes, toZonedTimestamp, getRealNow, parseShiftMins, getRelativeDate, COMBINED_LIMIT_MS, BREAK_LIMIT_MS, BRB_LIMIT_MS } from './timeUtils';

export interface ClientRow {
    id: string;
    name: string;
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function getClients(): Promise<ClientRow[]> {
    const { data } = await supabase.from('clients').select('*').order('name');
    return data ?? [];
}

export async function addClient(name: string): Promise<ClientRow> {
    const { data, error } = await supabase.from('clients').insert({ name: name.trim() }).select().single();
    if (error) throw error;
    return data as ClientRow;
}

export async function deleteClient(id: string): Promise<void> {
    await supabase.from('clients').delete().eq('id', id);
}

export async function renameClient(id: string, oldName: string, newName: string): Promise<void> {
    const freshName = newName.trim();
    if (!freshName) return;

    // 1. Rename the core client record
    const { error: cErr } = await supabase.from('clients').update({ name: freshName }).eq('id', id);
    if (cErr) throw cErr;

    // 2. Cascade rename across users
    const { error: uErr } = await supabase.from('users').update({ client_name: freshName }).eq('client_name', oldName);
    if (uErr) console.warn('Failed to cascade rename to users:', uErr);

    // 3. Cascade rename across leaves
    const { error: lErr } = await supabase.from('leaves').update({ client_name: freshName }).eq('client_name', oldName);
    if (lErr) console.warn('Failed to cascade rename to leaves:', lErr);
}

// ─── Leaves ───────────────────────────────────────────────────────────────────
export async function getLeaves(): Promise<LeaveRecord[]> {
    const { data } = await supabase.from('leaves').select('*').order('date', { ascending: false });
    return data ?? [];
}

export async function addLeave(leave: Omit<LeaveRecord, 'id' | 'created_at'>): Promise<LeaveRecord> {
    const { data, error } = await supabase.from('leaves').insert([leave]).select().single();
    if (error) throw error;
    return data as LeaveRecord;
}

export async function deleteLeave(id: string): Promise<void> {
    const { error } = await supabase.from('leaves').delete().eq('id', id);
    if (error) throw error;
}

export async function updateLeave(id: string, updates: Partial<LeaveRecord>): Promise<LeaveRecord> {
    const { data, error } = await supabase.from('leaves').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as LeaveRecord;
}

export interface SmartLeaveRecord extends LeaveRecord {
    is_smart?: boolean;
}

export async function getSmartLeaves(dates: string[]): Promise<SmartLeaveRecord[]> {
    if (!dates.length) return [];

    const { data: realLeavesData } = await supabase
        .from('leaves')
        .select('*')
        .order('date', { ascending: false });
    const realLeaves = (realLeavesData ?? []) as SmartLeaveRecord[];

    const users = await getAllUsers();
    const smartLeaves: SmartLeaveRecord[] = [...realLeaves];
    const realLeaveSet = new Set(realLeaves.map(l => `${l.employee_name.toLowerCase().trim()}-${l.client_name.toLowerCase().trim()}-${l.date}`));

    // Optimization: Fetch ALL logs for all users and all requested dates in ONE batch query
    const logsBatch = await getLogsBatch(users.map(u => u.id), dates);

    for (const d of dates) {
        const [yr, mo, dy] = d.split('-').map(Number);
        const dow = new Date(yr, mo - 1, dy).getDay();
        const isWeekend = dow === 0 || dow === 6;
        if (isWeekend) continue; // Skip weekends entirely

        const isToday = d === getTodayKey();

        for (const user of users) {
            const key = `${user.name.toLowerCase().trim()}-${user.clientName.toLowerCase().trim()}-${d}`;
            if (realLeaveSet.has(key)) continue;

            const rawUserLogs = logsBatch[`${user.id}-${d}`] || [];
            const virtualId = `virtual-${user.id}-${d}`;

            const userNowMins = toZonedMinutes(getRealNow(), user.timezone);
            const shiftStartMins = parseShiftMins(user.shiftStart);
            const shiftEndMins = parseShiftMins(user.shiftEnd);

            if (rawUserLogs.length === 0) {
                // If checking today, don't flag absent until 1 hour past shift start
                if (isToday && userNowMins < shiftStartMins + 60) continue;

                smartLeaves.push({
                    id: virtualId,
                    date: d,
                    client_name: user.clientName,
                    employee_name: user.name,
                    is_planned: false,
                    reason: 'No Punch In',
                    approver: null,
                    leave_type: 'System: Absent',
                    day_count: 1,
                    is_smart: true
                });
            } else {
                const status = deriveStatus(rawUserLogs);
                if (status.workedMs > 0 && status.workedMs < 14400000) {
                    if (isToday && status.status === 'working') continue;
                    if (isToday && userNowMins < shiftEndMins) continue;

                    smartLeaves.push({
                        id: virtualId,
                        date: d,
                        client_name: user.clientName,
                        employee_name: user.name,
                        is_planned: false,
                        reason: `Less Hours (${Math.round(status.workedMs / 60000)}m logged)`,
                        approver: null,
                        leave_type: 'System: Half-Day',
                        day_count: 0.5,
                        is_smart: true
                    });
                }
            }
        }
    }

    // Sort combined leaves — newest first
    smartLeaves.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.employee_name.localeCompare(b.employee_name);
    });

    return smartLeaves;
}

const CURRENT_USER_KEY = 'rp_current_user';
const REMEMBERED_USER_KEY = 'rp_remembered';

// ─── Remember Me (localStorage) ──────────────────────────────────────────────
export function getRememberedUser(): { name: string; clientName: string } | null {
    if (typeof window === 'undefined') return null;
    try { const r = localStorage.getItem(REMEMBERED_USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function rememberUser(name: string, clientName: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REMEMBERED_USER_KEY, JSON.stringify({ name, clientName }));
}
export function forgetUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REMEMBERED_USER_KEY);
}

// ─── Session (browser-local) ──────────────────────────────────────────────────
export function getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    try { const r = sessionStorage.getItem(CURRENT_USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function setCurrentUser(user: User | null): void {
    if (user) sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CURRENT_USER_KEY);
}

// ─── Row ↔ User conversion ────────────────────────────────────────────────────
function rowToUser(row: UserRow): User {
    return {
        id: row.id,
        name: row.name,
        clientName: row.client_name ?? '',
        isMaster: row.is_master,
        isApproved: row.is_approved ?? false,
        shiftStart: row.shift_start ?? '08:00',
        shiftEnd: row.shift_end ?? '17:00',
        timezone: row.timezone ?? 'America/Chicago',
        workMode: (row.work_mode === 'WFH' ? 'WFH' : 'WFO') as 'WFO' | 'WFH',
    };
}

// ─── User operations ──────────────────────────────────────────────────────────
export async function getUserByNameAndClient(name: string, clientName: string): Promise<User | null> {
    const { data } = await supabase
        .from('users').select('*')
        .ilike('name', name.trim())
        .ilike('client_name', clientName.trim())
        .maybeSingle();
    return data ? rowToUser(data as UserRow) : null;
}

export async function upsertUser(user: User): Promise<User> {
    const { data, error } = await supabase
        .from('users')
        .upsert({
            id: user.id,
            name: user.name,
            client_name: user.clientName,
            is_master: user.isMaster,
            is_approved: user.isApproved,
            work_mode: user.workMode ?? 'WFO',
        }, { onConflict: 'id' })
        .select().single();
    if (error) throw error;
    clearUserCache();
    return rowToUser(data as UserRow);
}

let cachedUsers: User[] | null = null;
let lastUserFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function getAllUsers(): Promise<User[]> {
    const now = Date.now();
    if (cachedUsers && (now - lastUserFetch < CACHE_TTL)) {
        return cachedUsers;
    }

    const { data } = await supabase.from('users').select('*').eq('is_master', false).order('client_name').order('name');
    cachedUsers = (data ?? []).map(r => rowToUser(r as UserRow));
    lastUserFetch = now;
    return cachedUsers;
}

export function clearUserCache() {
    cachedUsers = null;
    lastUserFetch = 0;
}

export async function getPendingUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*').eq('is_approved', false).eq('is_master', false);
    return (data ?? []).map(r => rowToUser(r as UserRow));
}

export async function approveUser(userId: string): Promise<void> {
    await supabase.from('users').update({ is_approved: true }).eq('id', userId);
    clearUserCache();
}

export async function deleteUser(userId: string): Promise<void> {
    // Cascade deletes time_logs via FK
    await supabase.from('users').delete().eq('id', userId);
    clearUserCache();
}

export async function updateUser(userId: string, updates: {
    name?: string; clientName?: string; isApproved?: boolean;
    shiftStart?: string; shiftEnd?: string; timezone?: string;
    workMode?: 'WFO' | 'WFH';
}): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.clientName !== undefined) payload.client_name = updates.clientName;
    if (updates.isApproved !== undefined) payload.is_approved = updates.isApproved;
    if (updates.shiftStart !== undefined) payload.shift_start = updates.shiftStart;
    if (updates.shiftEnd !== undefined) payload.shift_end = updates.shiftEnd;
    if (updates.timezone !== undefined) payload.timezone = updates.timezone;
    if (updates.workMode !== undefined) payload.work_mode = updates.workMode;
    const { data, error } = await supabase.from('users').update(payload).eq('id', userId).select().single();
    if (error) throw error;
    clearUserCache();
    return rowToUser(data as UserRow);
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
function rowToLog(row: LogRow): TimeLog {
    return {
        id: row.id, eventType: row.event_type as TimeLog['eventType'],
        timestamp: row.timestamp, date: row.date,
        addedBy: row.added_by ?? undefined,
    };
}

export async function getLogs(userId: string, date?: string): Promise<TimeLog[]> {
    const d = date ?? getTodayKey();
    const { data } = await supabase
        .from('time_logs').select('*')
        .eq('user_id', userId).eq('date', d)
        .order('timestamp', { ascending: true });
    return (data ?? []).map(r => rowToLog(r as LogRow));
}

export async function insertLog(userId: string, log: TimeLog): Promise<void> {
    const { error } = await supabase.from('time_logs').insert({
        id: log.id, user_id: userId, event_type: log.eventType,
        timestamp: log.timestamp, date: log.date, added_by: log.addedBy ?? null,
    });
    if (error) throw error;
}

export async function getLogsForDate(userId: string, date: string): Promise<TimeLog[]> {
    return getLogs(userId, date);
}

export async function getLogsBatch(userIds: string[], dates: string[]): Promise<Record<string, TimeLog[]>> {
    if (!userIds.length || !dates.length) return {};
    const { data, error } = await supabase
        .from('time_logs').select('*')
        .in('user_id', userIds)
        .in('date', dates)
        .order('timestamp', { ascending: true });
    
    if (error) throw error;
    
    const logsByDay: Record<string, TimeLog[]> = {};
    (data ?? []).forEach(r => {
        const key = `${r.user_id}-${r.date}`;
        if (!logsByDay[key]) logsByDay[key] = [];
        logsByDay[key].push(rowToLog(r as LogRow));
    });
    return logsByDay;
}

export async function deleteTimeLog(id: string): Promise<void> {
    const { error } = await supabase.from('time_logs').delete().eq('id', id);
    if (error) throw error;
}

export async function updateTimeLog(id: string, updates: Partial<TimeLog>): Promise<void> {
    const payload: Record<string, any> = {};
    if (updates.eventType) payload.event_type = updates.eventType;
    if (updates.timestamp) payload.timestamp = updates.timestamp;
    if (updates.date) payload.date = updates.date;
    
    const { error } = await supabase.from('time_logs').update(payload).eq('id', id);
    if (error) throw error;
}

export async function deleteUserLogsForToday(userId: string): Promise<void> {
    const { error } = await supabase.from('time_logs').delete().eq('user_id', userId).eq('date', getTodayKey());
    if (error) throw error;
}

export async function getLogDatesForMonth(userId: string, yearMonth: string): Promise<string[]> {
    const { data } = await supabase
        .from('time_logs').select('date')
        .eq('user_id', userId).like('date', `${yearMonth}-%`);
    const set = new Set((data ?? []).map((r: { date: string }) => r.date));
    return [...set].sort();
}

// ─── Master override ──────────────────────────────────────────────────────────
export async function masterOverride(userId: string, action: 'break_end' | 'brb_end' | 'punch_out', masterId: string): Promise<void> {
    const log: TimeLog = { id: generateUUID(), eventType: action, timestamp: Date.now(), date: getTodayKey(), addedBy: masterId };
    await insertLog(userId, log);
}

// ─── Status derivation ────────────────────────────────────────────────────────
export type UserStatus = AppStatus;
export interface UserStatusRecord {
    user: User; status: UserStatus;
    punchIn?: number; punchOut?: number;
    breakStart?: number; brbStart?: number;
    workStart?: number;
    workedMs: number;       // pure working time (breaks/BRB excluded)
    breakCount: number; brbCount: number;
}

function deriveStatus(logs: TimeLog[]): Omit<UserStatusRecord, 'user'> {
    let status: UserStatus = 'idle';
    let punchIn: number | undefined, punchOut: number | undefined;
    let breakStart: number | undefined, brbStart: number | undefined;
    let workStart: number | undefined;
    let breakCount = 0, brbCount = 0;
    let workedMs = 0;          // accumulate completed working spans
    let currentWorkSegStart: number | undefined;  // tracks current open work segment
    const now = Date.now();
    for (const log of logs) {
        switch (log.eventType) {
            case 'punch_in':
                status = 'working'; punchIn = log.timestamp; workStart = log.timestamp;
                currentWorkSegStart = log.timestamp;
                punchOut = undefined; breakStart = brbStart = undefined; break;
            case 'punch_out':
            case 'auto_logout':
                status = 'punched_out'; punchOut = log.timestamp; breakStart = brbStart = undefined; workStart = undefined;
                if (currentWorkSegStart) { workedMs += log.timestamp - currentWorkSegStart; currentWorkSegStart = undefined; } break;
            case 'break_start':
                status = 'on_break'; breakStart = log.timestamp; breakCount++; workStart = undefined;
                if (currentWorkSegStart) { workedMs += log.timestamp - currentWorkSegStart; currentWorkSegStart = undefined; } break;
            case 'break_end':
                status = 'working'; breakStart = undefined; workStart = log.timestamp;
                currentWorkSegStart = log.timestamp; break;
            case 'brb_start':
                status = 'on_brb'; brbStart = log.timestamp; brbCount++; workStart = undefined;
                if (currentWorkSegStart) { workedMs += log.timestamp - currentWorkSegStart; currentWorkSegStart = undefined; } break;
            case 'brb_end':
                status = 'working'; brbStart = undefined; workStart = log.timestamp;
                currentWorkSegStart = log.timestamp; break;
        }
    }
    // If still working, count current open segment up to now
    if (currentWorkSegStart && status === 'working') {
        workedMs += now - currentWorkSegStart;
    }
    return { status, punchIn, punchOut, breakStart, brbStart, workStart, workedMs, breakCount, brbCount };
}

export async function getAllUsersStatus(): Promise<UserStatusRecord[]> {
    const today = getTodayKey();
    const { data: usersData } = await supabase.from('users').select('*').eq('is_master', false).eq('is_approved', true);
    if (!usersData?.length) return [];
    const userIds = usersData.map((u: UserRow) => u.id);
    const penaltyLogsToInsert: any[] = [];
    const yesterday = getRelativeDate(today, -1);
    const checkDates = [yesterday, today]; // Check yesterday and today for lingering sessions

    const { data: logsData } = await supabase
        .from('time_logs')
        .select('*')
        .in('user_id', userIds)
        .in('date', checkDates)
        .order('timestamp', { ascending: true });
    
    const logsByUser: Record<string, Record<string, TimeLog[]>> = {};
    userIds.forEach((id: string) => { logsByUser[id] = { [yesterday]: [], [today]: [] }; });
    (logsData ?? []).forEach((r: LogRow) => {
        if (!logsByUser[r.user_id]) return;
        if (!logsByUser[r.user_id][r.date]) logsByUser[r.user_id][r.date] = [];
        logsByUser[r.user_id][r.date].push(rowToLog(r));
    });

    usersData.forEach((row: UserRow) => {
        const user = rowToUser(row);
        const shiftEndMins = parseShiftMins(user.shiftEnd);
        const userNowMins = toZonedMinutes(getRealNow(), user.timezone);

        for (const date of checkDates) {
            const logs = logsByUser[user.id][date] || [];
            if (!logs.length) continue;

            const currentStats = deriveStatus(logs);
            const isToday = date === today;
            
            if (currentStats.status !== 'idle' && currentStats.status !== 'punched_out' && currentStats.status !== 'on_leave') {
                // For past dates, if shift is over, auto-logout immediately at shift end
                // For today, if 90 mins past shift end, auto-logout
                const shouldLogout = !isToday || (userNowMins > shiftEndMins + 90);
                
                if (shouldLogout) {
                    // Standardized penalty: 10 minutes before their scheduled shift end
                    const penaltyTimestamp = toZonedTimestamp(date, user.shiftEnd, user.timezone) - (10 * 60000);
                    
                    const newLog = {
                        id: generateUUID(),
                        user_id: user.id,
                        event_type: 'auto_logout',
                        timestamp: penaltyTimestamp,
                        date: date,
                        added_by: 'system'
                    };
                    penaltyLogsToInsert.push(newLog);
                    
                    // Optimistically mutate for today's response if it happened today
                    if (isToday) logsByUser[user.id][today].push(rowToLog(newLog as any));
                }
            }
        }
    });

    if (penaltyLogsToInsert.length > 0) {
        supabase.from('time_logs').insert(penaltyLogsToInsert).then();
    }

    return usersData.map((row: UserRow) => ({ 
        user: rowToUser(row), 
        ...deriveStatus(logsByUser[row.id][today] ?? []) 
    }));
}

// ─── 7-day break/BRB aggregation (for Violators Panel) ───────────────────────
export interface UserBreakStats {
    user: User;
    avgBreakMs: number;
    avgBrbMs: number;
    totalBreakMs: number;
    totalBrbMs: number;
    breakViolDays: number; // legacy individual metric
    brbViolDays: number; // legacy individual metric
    combinedViolDays: number; // new: days where Break + BRB > 85m
    lateInDays: number;
    earlyOutDays: number;
    daysChecked: number;
    breakCounts: number[];   // per-day count
    brbCounts: number[];
}

export async function get7DayBreakStats(): Promise<UserBreakStats[]> {
    // Last 5 completed days (not including today)
    const days = getPastDaysZoned(5, true);


    const { data: usersData } = await supabase.from('users').select('*').eq('is_master', false).eq('is_approved', true);
    if (!usersData?.length) return [];

    const userIds = usersData.map((u: UserRow) => u.id);
    const { data: logsData } = await supabase
        .from('time_logs').select('*')
        .in('user_id', userIds)
        .in('date', days)
        .order('timestamp', { ascending: true });

    const BREAK_LIMIT = 75 * 60 * 1000;
    const BRB_LIMIT = 10 * 60 * 1000;
    const COMBINED_LIMIT = 85 * 60 * 1000; // 1h 25m

    return usersData.map((row: UserRow) => {
        const user = rowToUser(row);
        let totalBreakMs = 0, totalBrbMs = 0, breakViolDays = 0, brbViolDays = 0, combinedViolDays = 0, daysChecked = 0;
        let lateInDays = 0, earlyOutDays = 0;
        const breakCounts: number[] = [];
        const brbCounts: number[] = [];

        for (const day of days) {
            const dayLogs = (logsData ?? []).filter((l: LogRow) => l.user_id === row.id && l.date === day).map(rowToLog);
            if (!dayLogs.length) continue;
            daysChecked++;

            // Compute break/BRB/punch for this day
            let breakStart: number | null = null, brbStart: number | null = null;
            let dayPunchIn: number | undefined, dayPunchOut: number | undefined;
            let dayBreakMs = 0, dayBrbMs = 0, dayBreakCount = 0, dayBrbCount = 0;

            for (const log of dayLogs) {
                if (log.eventType === 'punch_in' && !dayPunchIn) dayPunchIn = log.timestamp;
                if (log.eventType === 'punch_out') dayPunchOut = log.timestamp;
                if (log.eventType === 'break_start') { breakStart = log.timestamp; dayBreakCount++; }
                if (log.eventType === 'break_end' && breakStart) { dayBreakMs += (log.timestamp - breakStart); breakStart = null; }
                if (log.eventType === 'brb_start') { brbStart = log.timestamp; dayBrbCount++; }
                if (log.eventType === 'brb_end' && brbStart) { dayBrbMs += (log.timestamp - brbStart); brbStart = null; }
            }

            const v = checkViolations(dayBreakMs, dayBrbMs, dayPunchIn, dayPunchOut, user.shiftStart, user.shiftEnd, user.timezone);

            totalBreakMs += dayBreakMs;
            totalBrbMs += dayBrbMs;
            if (v.breakViol) breakViolDays++;
            if (v.brbViol) brbViolDays++;
            if (v.lateIn) lateInDays++;
            if (v.earlyOut) earlyOutDays++;
            if ((dayBreakMs + dayBrbMs) > COMBINED_LIMIT) combinedViolDays++;

            breakCounts.push(dayBreakCount);
            brbCounts.push(dayBrbCount);
        }

        return {
            user, totalBreakMs, totalBrbMs, breakViolDays, brbViolDays, combinedViolDays,
            lateInDays, earlyOutDays, daysChecked, breakCounts, brbCounts,
            avgBreakMs: daysChecked > 0 ? totalBreakMs / daysChecked : 0,
            avgBrbMs: daysChecked > 0 ? totalBrbMs / daysChecked : 0,
        };
    });
}

// ─── Weekly Break Stats (for Aura Maxxers & Lobby Campers) ───────────────────
export interface WeeklyBreakStats {
    user: User;
    avgBreakMs: number;
    avgBrbMs: number;
    totalBreakMs: number;
    totalBrbMs: number;
    breakViolDays: number;
    brbViolDays: number;
    combinedViolDays: number;
    lateInDays: number;
    earlyOutDays: number;
    daysChecked: number;     // how many days user actually logged in
    expectedDays: number;    // how many weekdays have elapsed (for Aura Maxxers: must match daysChecked)
    isLastWeek: boolean;     // true when showing last week's data (on Mondays)
}

export async function getWeeklyBreakStats(): Promise<WeeklyBreakStats[]> {
    const { days, isLastWeek } = getElapsedWeekdays();
    const expectedDays = days.length;

    if (expectedDays === 0) return [];

    const { data: usersData } = await supabase.from('users').select('*').eq('is_master', false).eq('is_approved', true);
    if (!usersData?.length) return [];

    const userIds = usersData.map((u: UserRow) => u.id);
    const { data: logsData } = await supabase
        .from('time_logs').select('*')
        .in('user_id', userIds)
        .in('date', days)
        .order('timestamp', { ascending: true });

    const COMBINED_LIMIT = 85 * 60 * 1000;

    return usersData.map((row: UserRow) => {
        const user = rowToUser(row);
        let totalBreakMs = 0, totalBrbMs = 0, breakViolDays = 0, brbViolDays = 0, combinedViolDays = 0, daysChecked = 0;
        let lateInDays = 0, earlyOutDays = 0;

        for (const day of days) {
            const dayLogs = (logsData ?? []).filter((l: LogRow) => l.user_id === row.id && l.date === day).map(rowToLog);
            if (!dayLogs.length) continue;
            daysChecked++;

            let breakStart: number | null = null, brbStart: number | null = null;
            let dayPunchIn: number | undefined, dayPunchOut: number | undefined;
            let dayBreakMs = 0, dayBrbMs = 0;

            for (const log of dayLogs) {
                if (log.eventType === 'punch_in' && !dayPunchIn) dayPunchIn = log.timestamp;
                if (log.eventType === 'punch_out') dayPunchOut = log.timestamp;
                if (log.eventType === 'break_start') { breakStart = log.timestamp; }
                if (log.eventType === 'break_end' && breakStart) { dayBreakMs += (log.timestamp - breakStart); breakStart = null; }
                if (log.eventType === 'brb_start') { brbStart = log.timestamp; }
                if (log.eventType === 'brb_end' && brbStart) { dayBrbMs += (log.timestamp - brbStart); brbStart = null; }
            }

            const v = checkViolations(dayBreakMs, dayBrbMs, dayPunchIn, dayPunchOut, user.shiftStart, user.shiftEnd, user.timezone);

            totalBreakMs += dayBreakMs;
            totalBrbMs += dayBrbMs;
            if (v.breakViol) breakViolDays++;
            if (v.brbViol) brbViolDays++;
            if (v.lateIn) lateInDays++;
            if (v.earlyOut) earlyOutDays++;
            if ((dayBreakMs + dayBrbMs) > COMBINED_LIMIT) combinedViolDays++;
        }

        return {
            user, totalBreakMs, totalBrbMs, breakViolDays, brbViolDays, combinedViolDays,
            lateInDays, earlyOutDays, daysChecked, expectedDays, isLastWeek,
            avgBreakMs: daysChecked > 0 ? totalBreakMs / daysChecked : 0,
            avgBrbMs: daysChecked > 0 ? totalBrbMs / daysChecked : 0,
        };
    });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getActiveNotifications(userId: string): Promise<AppNotification[]> {
    // We want active notifications that have NOT been dismissed by this user
    // A query with a left join/filter is tricky in Supabase without a custom view,
    // so we'll fetch all active notifications and all dismissals for this user, then filter locally.
    const [{ data: notifs }, { data: dismissals }] = await Promise.all([
        supabase.from('notifications').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('notification_dismissals').select('notification_id').eq('user_id', userId)
    ]);

    const dismissedIds = new Set((dismissals ?? []).map((d: any) => d.notification_id));

    return (notifs ?? [])
        .filter((n: any) => !dismissedIds.has(n.id))
        .map((n: any) => ({
            id: n.id, message: n.message, createdBy: n.created_by,
            createdAt: n.created_at, isActive: n.is_active
        }));
}

export async function getAllNotifications(): Promise<AppNotification[]> {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    return (data ?? []).map((n: any) => ({
        id: n.id, message: n.message, createdBy: n.created_by,
        createdAt: n.created_at, isActive: n.is_active
    }));
}

export async function createNotification(message: string, adminId: string): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
        message, created_by: adminId, is_active: true
    });
    if (error) throw error;
}

export async function dismissNotification(notificationId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('notification_dismissals').insert({
        notification_id: notificationId, user_id: userId
    }).select().single();

    // Ignore 23505 (unique violation), it means they already dismissed it
    if (error && error.code !== '23505') throw error;
}

export async function deleteNotification(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
}

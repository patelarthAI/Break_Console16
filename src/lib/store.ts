import { supabase, UserRow, LogRow, describeSupabaseError } from './supabase';
import { User, TimeLog, AppStatus, LeaveRecord, AppNotification } from '@/types';
import { getTodayKey, generateUUID, getPastDaysZoned, getElapsedWeekdays, checkViolations, toZonedMinutes, toZonedTimestamp, getRealNow, parseShiftMins } from './timeUtils';

export interface ClientRow {
    id: string;
    name: string;
}

export interface PaginatedLeaveResult {
    items: LeaveRecord[];
    total: number;
    page: number;
    pageSize: number;
}

function assertSupabaseOk(error: unknown, action: string): void {
    if (!error) return;
    throw new Error(`${action}: ${describeSupabaseError(error)}`);
}

const USER_SELECT = 'id,name,client_name,is_master,is_approved,shift_start,shift_end,timezone,work_mode';
const LOG_SELECT = 'id,user_id,event_type,timestamp,date,added_by';
const CLIENT_SELECT = 'id,name';
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const LEAVES_CACHE_TTL_MS = 60 * 1000;
const STATS_CACHE_TTL_MS = 60 * 1000;

interface CacheEntry<T> {
    data: T;
    fetchedAt: number;
}

const queryCache = new Map<string, CacheEntry<unknown>>();
const inFlightQueries = new Map<string, Promise<unknown>>();

async function withCachedQuery<T>(key: string, ttlMs: number, load: () => Promise<T>, force = false): Promise<T> {
    if (!force) {
        const cached = queryCache.get(key) as CacheEntry<T> | undefined;
        if (cached && (Date.now() - cached.fetchedAt) < ttlMs) return cached.data;

        const inFlight = inFlightQueries.get(key) as Promise<T> | undefined;
        if (inFlight) return inFlight;
    }

    const promise = load()
        .then((data) => {
            queryCache.set(key, { data, fetchedAt: Date.now() });
            return data;
        })
        .finally(() => {
            inFlightQueries.delete(key);
        });

    inFlightQueries.set(key, promise as Promise<unknown>);
    return promise;
}

function invalidateCache(prefix: string): void {
    for (const key of Array.from(queryCache.keys())) {
        if (key.startsWith(prefix)) queryCache.delete(key);
    }
    for (const key of Array.from(inFlightQueries.keys())) {
        if (key.startsWith(prefix)) inFlightQueries.delete(key);
    }
}

function clearClientCache(): void {
    invalidateCache('clients');
}

function clearLeaveCache(): void {
    invalidateCache('leaves:');
}

function clearStatsCache(): void {
    invalidateCache('weekly-stats:');
    invalidateCache('seven-day-break-stats:');
    invalidateCache('status:');
}

function getLogBucketKey(userId: string, date: string): string {
    return `${userId}|${date}`;
}

function buildLogsByUserDate(rows: LogRow[]): Map<string, TimeLog[]> {
    const logsByUserDate = new Map<string, TimeLog[]>();

    for (const row of rows) {
        const key = getLogBucketKey(row.user_id, row.date);
        const bucket = logsByUserDate.get(key);
        const log = rowToLog(row);
        if (bucket) bucket.push(log);
        else logsByUserDate.set(key, [log]);
    }

    return logsByUserDate;
}

function getLogsForUserDate(logsByUserDate: Map<string, TimeLog[]>, userId: string, date: string): TimeLog[] {
    return logsByUserDate.get(getLogBucketKey(userId, date)) ?? [];
}

function withSyntheticAutoLogout(logs: TimeLog[], user: User, date: string): TimeLog[] {
    if (!logs.length) return logs;

    const stats = deriveStatus(logs);
    if (stats.status === 'idle' || stats.status === 'punched_out' || stats.status === 'on_leave') {
        return logs;
    }

    const userNowMins = toZonedMinutes(getRealNow(), user.timezone);
    const shiftEndMins = parseShiftMins(user.shiftEnd);
    if (userNowMins <= shiftEndMins + 90) return logs;

    const penaltyTimestamp = toZonedTimestamp(date, user.shiftEnd, user.timezone) - (10 * 60000);
    return [
        ...logs,
        {
            id: `synthetic-auto-logout-${user.id}-${date}`,
            eventType: 'auto_logout' as TimeLog['eventType'],
            timestamp: penaltyTimestamp,
            date,
            addedBy: 'system',
        }
    ].sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function getClients(force = false): Promise<ClientRow[]> {
    return withCachedQuery('clients', CLIENTS_CACHE_TTL_MS, async () => {
        const { data, error } = await supabase.from('clients').select(CLIENT_SELECT).order('name');
        assertSupabaseOk(error, 'Failed to load clients');
        return data ?? [];
    }, force);
}

export async function addClient(name: string): Promise<ClientRow> {
    const { data, error } = await supabase.from('clients').insert({ name: name.trim() }).select().single();
    if (error) throw error;
    clearClientCache();
    return data as ClientRow;
}

export async function deleteClient(id: string): Promise<void> {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    assertSupabaseOk(error, 'Failed to delete client');
    clearClientCache();
    clearLeaveCache();
    clearStatsCache();
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

    clearClientCache();
    clearLeaveCache();
    clearUserCache();
    clearStatsCache();
}

// ─── Leaves ───────────────────────────────────────────────────────────────────
export async function getLeaves(clientName?: string, force = false): Promise<LeaveRecord[]> {
    return withCachedQuery(`leaves:${clientName ?? '*'}`, LEAVES_CACHE_TTL_MS, async () => {
        let query = supabase
            .from('leaves')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });
        if (clientName) query = query.eq('client_name', clientName);
        const { data, error } = await query;
        assertSupabaseOk(error, 'Failed to load leaves');
        return data ?? [];
    }, force);
}

export async function getLeavesPage(options?: {
    clientName?: string;
    page?: number;
    pageSize?: number;
    force?: boolean;
}): Promise<PaginatedLeaveResult> {
    const {
        clientName,
        page = 1,
        pageSize = 25,
        force = false,
    } = options ?? {};

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const cacheKey = `leaves:page:${clientName ?? '*'}:${safePage}:${safePageSize}`;

    return withCachedQuery(cacheKey, LEAVES_CACHE_TTL_MS, async () => {
        let query = supabase
            .from('leaves')
            .select('*', { count: 'exact' })
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (clientName) query = query.eq('client_name', clientName);

        const { data, error, count } = await query;
        assertSupabaseOk(error, 'Failed to load leave records');

        return {
            items: (data ?? []) as LeaveRecord[],
            total: count ?? 0,
            page: safePage,
            pageSize: safePageSize,
        };
    }, force);
}

export async function addLeave(leave: Omit<LeaveRecord, 'id' | 'created_at'>): Promise<LeaveRecord> {
    const { data, error } = await supabase.from('leaves').insert([leave]).select().single();
    if (error) throw error;
    clearLeaveCache();
    return data as LeaveRecord;
}

export async function deleteLeave(id: string): Promise<void> {
    const { error } = await supabase.from('leaves').delete().eq('id', id);
    if (error) throw error;
    clearLeaveCache();
}

export async function updateLeave(id: string, updates: Partial<LeaveRecord>): Promise<LeaveRecord> {
    const { data, error } = await supabase.from('leaves').update(updates).eq('id', id).select().single();
    if (error) throw error;
    clearLeaveCache();
    return data as LeaveRecord;
}

export interface SmartLeaveRecord extends LeaveRecord {
    is_smart?: boolean;
}

export async function getSmartLeaves(dates: string[]): Promise<SmartLeaveRecord[]> {
    if (!dates.length) return [];

    const { data: realLeavesData, error: realLeavesError } = await supabase
        .from('leaves')
        .select('*')
        .order('date', { ascending: false });
    assertSupabaseOk(realLeavesError, 'Failed to load leave records');
    const realLeaves = (realLeavesData ?? []) as SmartLeaveRecord[];

    const users = await getAllUsers();
    const smartLeaves: SmartLeaveRecord[] = [...realLeaves];
    const realLeaveSet = new Set(realLeaves.map(l => `${l.employee_name.toLowerCase().trim()}-${l.client_name.toLowerCase().trim()}-${l.date}`));

    // Optimization: Fetch ALL logs for all users and all requested dates in ONE batch query
    const logsBatch = await getLogsBatch(users.map(u => u.id), dates);

    for (const user of users) {
        // Pre-calculate user status across ALL fetched logs for this 14-day period
        const userLogsCombined = Object.keys(logsBatch)
            .filter(k => k.startsWith(`${user.id}-`))
            .flatMap(k => logsBatch[k])
            .sort((a, b) => a.timestamp - b.timestamp);
        
        const overallStatus = userLogsCombined.length > 0 ? deriveStatus(userLogsCombined).status : 'idle';

        for (const d of dates) {
            const [yr, mo, dy] = d.split('-').map(Number);
            const dow = new Date(yr, mo - 1, dy).getDay();
            const isWeekend = dow === 0 || dow === 6;
            if (isWeekend) continue; // Skip weekends entirely

            const key = `${user.name.toLowerCase().trim()}-${user.clientName.toLowerCase().trim()}-${d}`;
            if (realLeaveSet.has(key)) continue;

            const rawUserLogs = logsBatch[`${user.id}-${d}`] || [];
            const virtualId = `virtual-${user.id}-${d}`;

            const isToday = d === getTodayKey();
            const userNowMins = toZonedMinutes(getRealNow(), user.timezone);
            const shiftStartMins = parseShiftMins(user.shiftStart);
            const shiftEndMins = parseShiftMins(user.shiftEnd);

            if (rawUserLogs.length === 0) {
                // If checking today, don't flag absent if:
                // 1. User is currently 'working' (potentially from a shift cross-over)
                // 2. It's before shift start + 60 mins
                if (isToday) {
                    if (overallStatus === 'working') continue;
                    if (userNowMins < shiftStartMins + 60) continue;
                }

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
                    if (isToday && (status.status === 'working' || overallStatus === 'working')) continue;
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

    // Filter out Dismissed/Declined records from display (they only exist to block virtual regeneration)
    const displayLeaves = smartLeaves.filter(l => l.leave_type !== 'Dismissed' && l.leave_type !== 'System: Declined');

    // Sort combined leaves — newest first
    displayLeaves.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.employee_name.localeCompare(b.employee_name);
    });

    return displayLeaves;
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
    const { data, error } = await supabase
        .from('users').select(USER_SELECT)
        .ilike('name', name.trim())
        .ilike('client_name', clientName.trim())
        .maybeSingle();
    assertSupabaseOk(error, 'Failed to load user');
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
            shift_start: user.shiftStart,
            shift_end: user.shiftEnd,
            timezone: user.timezone,
            work_mode: user.workMode ?? 'WFO',
        }, { onConflict: 'id' })
        .select().single();
    if (error) throw error;
    clearUserCache();
    clearStatsCache();
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

    const { data, error } = await supabase.from('users').select(USER_SELECT).eq('is_master', false).order('client_name').order('name');
    assertSupabaseOk(error, 'Failed to load users');
    cachedUsers = (data ?? []).map(r => rowToUser(r as UserRow));
    lastUserFetch = now;
    return cachedUsers;
}

export function clearUserCache() {
    cachedUsers = null;
    lastUserFetch = 0;
}

export async function getPendingUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select(USER_SELECT).eq('is_approved', false).eq('is_master', false);
    assertSupabaseOk(error, 'Failed to load pending users');
    return (data ?? []).map(r => rowToUser(r as UserRow));
}

export async function approveUser(userId: string): Promise<void> {
    const { error } = await supabase.from('users').update({ is_approved: true }).eq('id', userId);
    assertSupabaseOk(error, 'Failed to approve user');
    clearUserCache();
    clearStatsCache();
}

export async function deleteUser(userId: string): Promise<void> {
    // Cascade deletes time_logs via FK
    const { error } = await supabase.from('users').delete().eq('id', userId);
    assertSupabaseOk(error, 'Failed to delete user');
    clearUserCache();
    clearStatsCache();
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
    clearStatsCache();
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
    const { data, error } = await supabase
        .from('time_logs').select(LOG_SELECT)
        .eq('user_id', userId).eq('date', d)
        .order('timestamp', { ascending: true });
    assertSupabaseOk(error, 'Failed to load time logs');
    return (data ?? []).map(r => rowToLog(r as LogRow));
}

export async function insertLog(userId: string, log: TimeLog): Promise<void> {
    const { error } = await supabase.from('time_logs').insert({
        id: log.id, user_id: userId, event_type: log.eventType,
        timestamp: log.timestamp, date: log.date, added_by: log.addedBy ?? null,
    });
    if (error) throw error;
    clearStatsCache();
}

export async function getLogsForDate(userId: string, date: string): Promise<TimeLog[]> {
    return getLogs(userId, date);
}

export async function getLogsBatch(userIds: string[], dates: string[]): Promise<Record<string, TimeLog[]>> {
    if (!userIds.length || !dates.length) return {};

    const logsByDay: Record<string, TimeLog[]> = {};
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('time_logs').select(LOG_SELECT)
            .in('user_id', userIds)
            .in('date', dates)
            .order('timestamp', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const rows = data ?? [];

        rows.forEach(r => {
            const key = `${r.user_id}-${r.date}`;
            if (!logsByDay[key]) logsByDay[key] = [];
            logsByDay[key].push(rowToLog(r as LogRow));
        });

        hasMore = rows.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }

    return logsByDay;
}


export async function deleteTimeLog(id: string): Promise<void> {
    const { error } = await supabase.from('time_logs').delete().eq('id', id);
    if (error) throw error;
    clearStatsCache();
}

export async function updateTimeLog(id: string, updates: Partial<TimeLog>): Promise<void> {
    const payload: Record<string, any> = {};
    if (updates.eventType) payload.event_type = updates.eventType;
    if (updates.timestamp) payload.timestamp = updates.timestamp;
    if (updates.date) payload.date = updates.date;
    
    const { error } = await supabase.from('time_logs').update(payload).eq('id', id);
    if (error) throw error;
    clearStatsCache();
}

export async function deleteUserLogsForToday(userId: string): Promise<void> {
    const { error } = await supabase.from('time_logs').delete().eq('user_id', userId).eq('date', getTodayKey());
    if (error) throw error;
    clearStatsCache();
}

export async function getLogDatesForMonth(userId: string, yearMonth: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('time_logs').select('date')
        .eq('user_id', userId).like('date', `${yearMonth}-%`);
    assertSupabaseOk(error, 'Failed to load monthly log dates');
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

export async function getAllUsersStatus(clientName?: string, force = false): Promise<UserStatusRecord[]> {
    return withCachedQuery(`status:${clientName ?? '*'}`, 2000, async () => {
        const today = getTodayKey();
        let usersQuery = supabase
            .from('users')
            .select(USER_SELECT)
            .eq('is_master', false)
            .eq('is_approved', true);
        if (clientName) usersQuery = usersQuery.eq('client_name', clientName);

        const { data: usersData, error: usersError } = await usersQuery.order('client_name').order('name');
        assertSupabaseOk(usersError, 'Failed to load approved users');
        if (!usersData?.length) return [];

        const userIds = usersData.map((u: UserRow) => u.id);
        const { data: logsData, error: logsError } = await supabase
            .from('time_logs')
            .select(LOG_SELECT)
            .in('user_id', userIds)
            .eq('date', today)
            .order('timestamp', { ascending: true });
        assertSupabaseOk(logsError, 'Failed to load status logs');

        const logsByUserDate = buildLogsByUserDate((logsData ?? []) as LogRow[]);

        return usersData.map((row: UserRow) => {
            const user = rowToUser(row);
            const todaysLogs = withSyntheticAutoLogout(
                getLogsForUserDate(logsByUserDate, user.id, today),
                user,
                today
            );

            return {
                user,
                ...deriveStatus(todaysLogs),
            };
        });
    }, force);
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

export async function get7DayBreakStats(clientName?: string, force = false): Promise<UserBreakStats[]> {
    return withCachedQuery(`seven-day-break-stats:${clientName ?? '*'}`, STATS_CACHE_TTL_MS, async () => {
        const days = getPastDaysZoned(5, true);
        let usersQuery = supabase
            .from('users')
            .select(USER_SELECT)
            .eq('is_master', false)
            .eq('is_approved', true);
        if (clientName) usersQuery = usersQuery.eq('client_name', clientName);

        const { data: usersData, error: usersError } = await usersQuery.order('client_name').order('name');
        assertSupabaseOk(usersError, 'Failed to load users for break stats');
        if (!usersData?.length) return [];

        const userIds = usersData.map((u: UserRow) => u.id);
        const { data: logsData, error: logsError } = await supabase
            .from('time_logs')
            .select(LOG_SELECT)
            .in('user_id', userIds)
            .in('date', days)
            .order('timestamp', { ascending: true });
        assertSupabaseOk(logsError, 'Failed to load break stats logs');

        const logsByUserDate = buildLogsByUserDate((logsData ?? []) as LogRow[]);
        const combinedLimit = 85 * 60 * 1000;

        return usersData.map((row: UserRow) => {
            const user = rowToUser(row);
            let totalBreakMs = 0;
            let totalBrbMs = 0;
            let breakViolDays = 0;
            let brbViolDays = 0;
            let combinedViolDays = 0;
            let daysChecked = 0;
            let lateInDays = 0;
            let earlyOutDays = 0;
            const breakCounts: number[] = [];
            const brbCounts: number[] = [];

            for (const day of days) {
                const dayLogs = getLogsForUserDate(logsByUserDate, row.id, day);
                if (!dayLogs.length) continue;
                daysChecked++;

                let breakStart: number | null = null;
                let brbStart: number | null = null;
                let dayPunchIn: number | undefined;
                let dayPunchOut: number | undefined;
                let dayBreakMs = 0;
                let dayBrbMs = 0;
                let dayBreakCount = 0;
                let dayBrbCount = 0;

                for (const log of dayLogs) {
                    if (log.eventType === 'punch_in' && !dayPunchIn) dayPunchIn = log.timestamp;
                    if (log.eventType === 'punch_out') dayPunchOut = log.timestamp;
                    if (log.eventType === 'break_start') { breakStart = log.timestamp; dayBreakCount++; }
                    if (log.eventType === 'break_end' && breakStart) { dayBreakMs += (log.timestamp - breakStart); breakStart = null; }
                    if (log.eventType === 'brb_start') { brbStart = log.timestamp; dayBrbCount++; }
                    if (log.eventType === 'brb_end' && brbStart) { dayBrbMs += (log.timestamp - brbStart); brbStart = null; }
                }

                const violations = checkViolations(dayBreakMs, dayBrbMs, dayPunchIn, dayPunchOut, user.shiftStart, user.shiftEnd, user.timezone);

                totalBreakMs += dayBreakMs;
                totalBrbMs += dayBrbMs;
                if (violations.breakViol) breakViolDays++;
                if (violations.brbViol) brbViolDays++;
                if (violations.lateIn) lateInDays++;
                if (violations.earlyOut) earlyOutDays++;
                if ((dayBreakMs + dayBrbMs) > combinedLimit) combinedViolDays++;

                breakCounts.push(dayBreakCount);
                brbCounts.push(dayBrbCount);
            }

            return {
                user,
                totalBreakMs,
                totalBrbMs,
                breakViolDays,
                brbViolDays,
                combinedViolDays,
                lateInDays,
                earlyOutDays,
                daysChecked,
                breakCounts,
                brbCounts,
                avgBreakMs: daysChecked > 0 ? totalBreakMs / daysChecked : 0,
                avgBrbMs: daysChecked > 0 ? totalBrbMs / daysChecked : 0,
            };
        });
    }, force);
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

export async function getWeeklyBreakStats(clientName?: string, force = false): Promise<WeeklyBreakStats[]> {
    return withCachedQuery(`weekly-stats:${clientName ?? '*'}`, STATS_CACHE_TTL_MS, async () => {
        const { days, isLastWeek } = getElapsedWeekdays();
        const expectedDays = days.length;
        if (expectedDays === 0) return [];

        let usersQuery = supabase
            .from('users')
            .select(USER_SELECT)
            .eq('is_master', false)
            .eq('is_approved', true);
        if (clientName) usersQuery = usersQuery.eq('client_name', clientName);

        const { data: usersData, error: usersError } = await usersQuery.order('client_name').order('name');
        assertSupabaseOk(usersError, 'Failed to load users for weekly stats');
        if (!usersData?.length) return [];

        const userIds = usersData.map((u: UserRow) => u.id);
        const { data: logsData, error: logsError } = await supabase
            .from('time_logs')
            .select(LOG_SELECT)
            .in('user_id', userIds)
            .in('date', days)
            .order('timestamp', { ascending: true });
        assertSupabaseOk(logsError, 'Failed to load weekly stats logs');

        const logsByUserDate = buildLogsByUserDate((logsData ?? []) as LogRow[]);
        const combinedLimit = 85 * 60 * 1000;

        return usersData.map((row: UserRow) => {
            const user = rowToUser(row);
            let totalBreakMs = 0;
            let totalBrbMs = 0;
            let breakViolDays = 0;
            let brbViolDays = 0;
            let combinedViolDays = 0;
            let daysChecked = 0;
            let lateInDays = 0;
            let earlyOutDays = 0;

            for (const day of days) {
                const dayLogs = getLogsForUserDate(logsByUserDate, row.id, day);
                if (!dayLogs.length) continue;
                daysChecked++;

                let breakStart: number | null = null;
                let brbStart: number | null = null;
                let dayPunchIn: number | undefined;
                let dayPunchOut: number | undefined;
                let dayBreakMs = 0;
                let dayBrbMs = 0;

                for (const log of dayLogs) {
                    if (log.eventType === 'punch_in' && !dayPunchIn) dayPunchIn = log.timestamp;
                    if (log.eventType === 'punch_out') dayPunchOut = log.timestamp;
                    if (log.eventType === 'break_start') breakStart = log.timestamp;
                    if (log.eventType === 'break_end' && breakStart) { dayBreakMs += (log.timestamp - breakStart); breakStart = null; }
                    if (log.eventType === 'brb_start') brbStart = log.timestamp;
                    if (log.eventType === 'brb_end' && brbStart) { dayBrbMs += (log.timestamp - brbStart); brbStart = null; }
                }

                const violations = checkViolations(dayBreakMs, dayBrbMs, dayPunchIn, dayPunchOut, user.shiftStart, user.shiftEnd, user.timezone);

                totalBreakMs += dayBreakMs;
                totalBrbMs += dayBrbMs;
                if (violations.breakViol) breakViolDays++;
                if (violations.brbViol) brbViolDays++;
                if (violations.lateIn) lateInDays++;
                if (violations.earlyOut) earlyOutDays++;
                if ((dayBreakMs + dayBrbMs) > combinedLimit) combinedViolDays++;
            }

            return {
                user,
                totalBreakMs,
                totalBrbMs,
                breakViolDays,
                brbViolDays,
                combinedViolDays,
                lateInDays,
                earlyOutDays,
                daysChecked,
                expectedDays,
                isLastWeek,
                avgBreakMs: daysChecked > 0 ? totalBreakMs / daysChecked : 0,
                avgBrbMs: daysChecked > 0 ? totalBrbMs / daysChecked : 0,
            };
        });
    }, force);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getActiveNotifications(userId: string): Promise<AppNotification[]> {
    // We want active notifications that have NOT been dismissed by this user
    // A query with a left join/filter is tricky in Supabase without a custom view,
    // so we'll fetch all active notifications and all dismissals for this user, then filter locally.
    const [{ data: notifs, error: notifsError }, { data: dismissals, error: dismissalsError }] = await Promise.all([
        supabase.from('notifications').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('notification_dismissals').select('notification_id').eq('user_id', userId)
    ]);
    assertSupabaseOk(notifsError, 'Failed to load active notifications');
    assertSupabaseOk(dismissalsError, 'Failed to load dismissed notifications');

    const dismissedIds = new Set((dismissals ?? []).map((d: any) => d.notification_id));

    return (notifs ?? [])
        .filter((n: any) => !dismissedIds.has(n.id))
        .map((n: any) => ({
            id: n.id, message: n.message, createdBy: n.created_by,
            createdAt: n.created_at, isActive: n.is_active
        }));
}

export async function getAllNotifications(): Promise<AppNotification[]> {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    assertSupabaseOk(error, 'Failed to load notifications');
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

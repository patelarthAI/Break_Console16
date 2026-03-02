import { supabase, UserRow, LogRow } from './supabase';
import { User, TimeLog, AppStatus, LeaveRecord } from '@/types';
import { getTodayKey, generateUUID } from './timeUtils';

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
        }, { onConflict: 'id' })
        .select().single();
    if (error) throw error;
    return rowToUser(data as UserRow);
}

export async function getAllUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*').eq('is_master', false).order('client_name').order('name');
    return (data ?? []).map(r => rowToUser(r as UserRow));
}

export async function getPendingUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*').eq('is_approved', false).eq('is_master', false);
    return (data ?? []).map(r => rowToUser(r as UserRow));
}

export async function approveUser(userId: string): Promise<void> {
    await supabase.from('users').update({ is_approved: true }).eq('id', userId);
}

export async function deleteUser(userId: string): Promise<void> {
    // Cascade deletes time_logs via FK
    await supabase.from('users').delete().eq('id', userId);
}

export async function updateUser(userId: string, updates: { name?: string; clientName?: string; isApproved?: boolean }): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.clientName !== undefined) payload.client_name = updates.clientName;
    if (updates.isApproved !== undefined) payload.is_approved = updates.isApproved;
    const { data, error } = await supabase.from('users').update(payload).eq('id', userId).select().single();
    if (error) throw error;
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
    breakCount: number; brbCount: number;
}

function deriveStatus(logs: TimeLog[]): Omit<UserStatusRecord, 'user'> {
    let status: UserStatus = 'idle';
    let punchIn: number | undefined, punchOut: number | undefined;
    let breakStart: number | undefined, brbStart: number | undefined;
    let breakCount = 0, brbCount = 0;
    for (const log of logs) {
        switch (log.eventType) {
            case 'punch_in': status = 'working'; punchIn = log.timestamp; punchOut = undefined; breakStart = brbStart = undefined; break;
            case 'punch_out': status = 'punched_out'; punchOut = log.timestamp; breakStart = brbStart = undefined; break;
            case 'break_start': status = 'on_break'; breakStart = log.timestamp; breakCount++; break;
            case 'break_end': status = 'working'; breakStart = undefined; break;
            case 'brb_start': status = 'on_brb'; brbStart = log.timestamp; brbCount++; break;
            case 'brb_end': status = 'working'; brbStart = undefined; break;
        }
    }
    return { status, punchIn, punchOut, breakStart, brbStart, breakCount, brbCount };
}

export async function getAllUsersStatus(): Promise<UserStatusRecord[]> {
    const today = getTodayKey();
    const { data: usersData } = await supabase.from('users').select('*').eq('is_master', false).eq('is_approved', true);
    if (!usersData?.length) return [];
    const userIds = usersData.map((u: UserRow) => u.id);
    const { data: logsData } = await supabase.from('time_logs').select('*').in('user_id', userIds).eq('date', today).order('timestamp', { ascending: true });
    const logsByUser: Record<string, TimeLog[]> = {};
    userIds.forEach((id: string) => { logsByUser[id] = []; });
    (logsData ?? []).forEach((r: LogRow) => { logsByUser[r.user_id]?.push(rowToLog(r)); });
    return usersData.map((row: UserRow) => ({ user: rowToUser(row), ...deriveStatus(logsByUser[row.id] ?? []) }));
}

// ─── 7-day break/BRB aggregation (for Violators Panel) ───────────────────────
export interface UserBreakStats {
    user: User;
    avgBreakMs: number;
    avgBrbMs: number;
    totalBreakMs: number;
    totalBrbMs: number;
    breakViolDays: number;
    brbViolDays: number;
    daysChecked: number;
    breakCounts: number[];   // per-day count
    brbCounts: number[];
}

export async function get7DayBreakStats(): Promise<UserBreakStats[]> {
    // Build last 7 calendar days (not just work days)
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

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

    return usersData.map((row: UserRow) => {
        const user = rowToUser(row);
        let totalBreakMs = 0, totalBrbMs = 0, breakViolDays = 0, brbViolDays = 0, daysChecked = 0;
        const breakCounts: number[] = [];
        const brbCounts: number[] = [];

        for (const day of days) {
            const dayLogs = (logsData ?? []).filter((l: LogRow) => l.user_id === row.id && l.date === day).map(rowToLog);
            if (!dayLogs.length) continue;
            daysChecked++;

            // Compute break/BRB for this day
            let breakStart: number | null = null, brbStart: number | null = null;
            let dayBreakMs = 0, dayBrbMs = 0, dayBreakCount = 0, dayBrbCount = 0;
            const now = Date.now();
            for (const log of dayLogs) {
                if (log.eventType === 'break_start') { breakStart = log.timestamp; dayBreakCount++; }
                if (log.eventType === 'break_end' && breakStart) { dayBreakMs += (log.timestamp - breakStart); breakStart = null; }
                if (log.eventType === 'brb_start') { brbStart = log.timestamp; dayBrbCount++; }
                if (log.eventType === 'brb_end' && brbStart) { dayBrbMs += (log.timestamp - brbStart); brbStart = null; }
            }
            if (breakStart) dayBreakMs += (now - breakStart);
            if (brbStart) dayBrbMs += (now - brbStart);

            totalBreakMs += dayBreakMs;
            totalBrbMs += dayBrbMs;
            if (dayBreakMs > BREAK_LIMIT) breakViolDays++;
            if (dayBrbMs > BRB_LIMIT) brbViolDays++;
            breakCounts.push(dayBreakCount);
            brbCounts.push(dayBrbCount);
        }

        return {
            user, totalBreakMs, totalBrbMs, breakViolDays, brbViolDays, daysChecked, breakCounts, brbCounts,
            avgBreakMs: daysChecked > 0 ? totalBreakMs / daysChecked : 0,
            avgBrbMs: daysChecked > 0 ? totalBrbMs / daysChecked : 0,
        };
    });
}


import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow up to 60s for large teams

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRow {
    id: string;
    name: string;
    client_name: string;
    is_master: boolean;
    is_approved: boolean;
    shift_start: string;
    shift_end: string;
    timezone: string;
}

interface LogRow {
    id: string;
    user_id: string;
    event_type: string;
    timestamp: number;
    date: string;
    added_by: string | null;
}

interface LeaveRow {
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

// ─── Constants ────────────────────────────────────────────────────────────────
const AUTO_LOGOUT_ADDED_BY = 'system:auto-logout';
const AUTO_LEAVE_APPROVER = 'System Generated';
const HALF_DAY_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
const SHIFT_OVERRUN_MINS = 90; // wait 90 min past shift end before auto-logout
const SYSTEM_AUTO_LEAVE_TYPES = new Set(['System: Absent', 'System: Half-Day']);
const BLOCKED_LEAVE_TYPES = new Set(['Dismissed', 'System: Declined']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseShiftMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function toZonedMinutes(ts: number, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    }).formatToParts(new Date(ts));
    const h = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
    return (h === 24 ? 0 : h) * 60 + m;
}

function toZonedTimestamp(dateStr: string, timeStr: string, timezone: string): number {
    const utcMidnight = new Date(dateStr + 'T00:00:00Z').getTime();
    const localMinsAtUtcMidnight = toZonedMinutes(utcMidnight, timezone);
    const adjustmentMins = (1440 - localMinsAtUtcMidnight) % 1440;
    const zonedMidnight = utcMidnight + adjustmentMins * 60000;
    const targetMins = parseShiftMins(timeStr);
    return zonedMidnight + targetMins * 60000;
}

function getTodayKey(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')!.value;
    const mo = parts.find((p) => p.type === 'month')!.value;
    const d = parts.find((p) => p.type === 'day')!.value;
    return `${y}-${mo}-${d}`;
}

function getYesterdayKey(): string {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(yesterday);
    const y = parts.find((p) => p.type === 'year')!.value;
    const mo = parts.find((p) => p.type === 'month')!.value;
    const d = parts.find((p) => p.type === 'day')!.value;
    return `${y}-${mo}-${d}`;
}

function isWeekday(dateStr: string): boolean {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay();
    return dow >= 1 && dow <= 5;
}

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function isActiveEvent(eventType: string): boolean {
    return ['punch_in', 'break_end', 'brb_end', 'break_start', 'brb_start'].includes(eventType);
}

function isSystemAutoLeave(leave: LeaveRow): boolean {
    return (
        SYSTEM_AUTO_LEAVE_TYPES.has(leave.leave_type) ||
        (leave.approver ?? '').trim().toLowerCase() === AUTO_LEAVE_APPROVER.toLowerCase()
    );
}

function normalizeLeaveKey(name: string, client: string, date: string): string {
    return `${name.toLowerCase().trim()}|${client.toLowerCase().trim()}|${date}`;
}

// ─── Derive worked time from logs ─────────────────────────────────────────────
function deriveWorkedMs(logs: LogRow[]): { workedMs: number; lastEvent: string; hasPunchIn: boolean } {
    let workedMs = 0;
    let currentWorkSegStart: number | undefined;
    let status = 'idle';
    let hasPunchIn = false;

    for (const log of logs) {
        switch (log.event_type) {
            case 'punch_in':
                hasPunchIn = true;
                status = 'working';
                currentWorkSegStart = log.timestamp;
                break;
            case 'punch_out':
            case 'auto_logout':
                status = 'punched_out';
                if (currentWorkSegStart) {
                    workedMs += log.timestamp - currentWorkSegStart;
                    currentWorkSegStart = undefined;
                }
                break;
            case 'break_start':
                status = 'on_break';
                if (currentWorkSegStart) {
                    workedMs += log.timestamp - currentWorkSegStart;
                    currentWorkSegStart = undefined;
                }
                break;
            case 'break_end':
                status = 'working';
                currentWorkSegStart = log.timestamp;
                break;
            case 'brb_start':
                status = 'on_brb';
                if (currentWorkSegStart) {
                    workedMs += log.timestamp - currentWorkSegStart;
                    currentWorkSegStart = undefined;
                }
                break;
            case 'brb_end':
                status = 'working';
                currentWorkSegStart = log.timestamp;
                break;
        }
    }

    // If still in an active work segment, count up to now
    if (currentWorkSegStart && status === 'working') {
        workedMs += Date.now() - currentWorkSegStart;
    }

    return { workedMs, lastEvent: logs.length > 0 ? logs[logs.length - 1].event_type : 'none', hasPunchIn };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    // Auth check for external cron callers
    // Allow: internal fetch calls (same origin/referer), curl (no origin), or valid key
    const cronSecret = process.env.CRON_SECRET;
    const providedKey = request.nextUrl.searchParams.get('key');
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    const isInternalCall = !origin || origin.includes('localhost') || origin.includes(request.nextUrl.hostname);

    if (cronSecret && !isInternalCall && providedKey !== cronSecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const today = getTodayKey();
    const yesterday = getYesterdayKey();
    const datesToProcess = [yesterday, today].filter(isWeekday);

    const summary = {
        autoLogoutsInserted: 0,
        leavesCreated: 0,
        leavesUpdated: 0,
        leavesDeleted: 0,
        duplicatesCleaned: 0,
        errors: [] as string[],
        datesProcessed: datesToProcess,
    };

    try {
        // 1. Fetch all approved non-master users
        const { data: usersData, error: usersError } = await supabaseServer
            .from('users')
            .select('id,name,client_name,is_master,is_approved,shift_start,shift_end,timezone')
            .eq('is_master', false)
            .eq('is_approved', true)
            .order('client_name')
            .order('name');

        if (usersError) {
            summary.errors.push(`Failed to load users: ${usersError.message}`);
            return Response.json(summary, { status: 500 });
        }

        const users = (usersData ?? []) as UserRow[];
        if (!users.length) {
            return Response.json({ ...summary, message: 'No approved users found.' });
        }

        const userIds = users.map((u) => u.id);

        // 2. Fetch all logs for target dates
        const { data: logsData, error: logsError } = await supabaseServer
            .from('time_logs')
            .select('id,user_id,event_type,timestamp,date,added_by')
            .in('user_id', userIds)
            .in('date', datesToProcess)
            .order('timestamp', { ascending: true });

        if (logsError) {
            summary.errors.push(`Failed to load logs: ${logsError.message}`);
            return Response.json(summary, { status: 500 });
        }

        const allLogs = (logsData ?? []) as LogRow[];

        // Build logs index: userId|date -> LogRow[]
        const logIndex = new Map<string, LogRow[]>();
        for (const log of allLogs) {
            const key = `${log.user_id}|${log.date}`;
            const bucket = logIndex.get(key);
            if (bucket) bucket.push(log);
            else logIndex.set(key, [log]);
        }

        // 3. Fetch existing leaves for target dates
        const { data: leavesData, error: leavesError } = await supabaseServer
            .from('leaves')
            .select('*')
            .in('date', datesToProcess)
            .order('created_at', { ascending: false });

        if (leavesError) {
            summary.errors.push(`Failed to load leaves: ${leavesError.message}`);
            return Response.json(summary, { status: 500 });
        }

        const existingLeaves = (leavesData ?? []) as LeaveRow[];

        // Build leave index: normalized key -> LeaveRow[]
        const leaveIndex = new Map<string, LeaveRow[]>();
        for (const leave of existingLeaves) {
            const key = normalizeLeaveKey(leave.employee_name, leave.client_name, leave.date);
            const bucket = leaveIndex.get(key);
            if (bucket) bucket.push(leave);
            else leaveIndex.set(key, [leave]);
        }

        // ═════════════════════════════════════════════════════════════════════
        // STEP A: Auto-Logout Persistence
        // ═════════════════════════════════════════════════════════════════════

        const autoLogoutInserts: {
            id: string;
            user_id: string;
            event_type: string;
            timestamp: number;
            date: string;
            added_by: string;
        }[] = [];

        for (const user of users) {
            for (const date of datesToProcess) {
                const key = `${user.id}|${date}`;
                const dayLogs = logIndex.get(key) ?? [];

                if (!dayLogs.length) continue;

                // Check if already has a punch_out or auto_logout
                const hasLogout = dayLogs.some(
                    (l) => l.event_type === 'punch_out' || l.event_type === 'auto_logout',
                );
                if (hasLogout) continue;

                // Check if the last event is an "active" state
                const lastLog = dayLogs[dayLogs.length - 1];
                if (!isActiveEvent(lastLog.event_type)) continue;

                // Check if enough time has passed after shift end
                const shiftEndMins = parseShiftMins(user.shift_end || '17:00');
                const userNowMins = toZonedMinutes(now, user.timezone || 'America/Chicago');
                const isToday = date === today;

                if (isToday && userNowMins <= shiftEndMins + SHIFT_OVERRUN_MINS) {
                    // Not enough time past shift end yet for today
                    continue;
                }

                // For yesterday (or past dates), always insert if missing
                // Timestamp: 10 minutes before shift end
                const logoutTimestamp = toZonedTimestamp(
                    date,
                    user.shift_end || '17:00',
                    user.timezone || 'America/Chicago',
                ) - 10 * 60000;

                autoLogoutInserts.push({
                    id: generateUUID(),
                    user_id: user.id,
                    event_type: 'auto_logout',
                    timestamp: logoutTimestamp,
                    date,
                    added_by: AUTO_LOGOUT_ADDED_BY,
                });
            }
        }

        if (autoLogoutInserts.length > 0) {
            const { error } = await supabaseServer.from('time_logs').insert(autoLogoutInserts);
            if (error) {
                summary.errors.push(`Failed to insert auto-logouts: ${error.message}`);
            } else {
                summary.autoLogoutsInserted = autoLogoutInserts.length;

                // Update the log index with the new entries so auto-leave logic sees them
                for (const insert of autoLogoutInserts) {
                    const key = `${insert.user_id}|${insert.date}`;
                    const bucket = logIndex.get(key);
                    if (bucket) {
                        bucket.push(insert as unknown as LogRow);
                        bucket.sort((a, b) => a.timestamp - b.timestamp);
                    }
                }
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // STEP B: Auto-Leave Sync
        // ═════════════════════════════════════════════════════════════════════

        // First: Clean up duplicates per user+date
        const duplicateIdsToDelete: string[] = [];
        const canonicalLeaves = new Map<string, LeaveRow>();

        for (const [key, bucket] of leaveIndex.entries()) {
            const humanOrBlocked = bucket.find((l) => !isSystemAutoLeave(l));
            if (humanOrBlocked) {
                canonicalLeaves.set(key, humanOrBlocked);
            } else {
                // Keep newest system leave
                const sorted = [...bucket].sort((a, b) => {
                    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
                    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
                    return bTime - aTime;
                });
                if (sorted[0]) canonicalLeaves.set(key, sorted[0]);
            }

            const keepId = canonicalLeaves.get(key)?.id;
            for (const leave of bucket) {
                if (leave.id !== keepId) duplicateIdsToDelete.push(leave.id);
            }
        }

        if (duplicateIdsToDelete.length > 0) {
            const { error } = await supabaseServer
                .from('leaves')
                .delete()
                .in('id', duplicateIdsToDelete);
            if (error) {
                summary.errors.push(`Failed to clean duplicates: ${error.message}`);
            } else {
                summary.duplicatesCleaned = duplicateIdsToDelete.length;
            }
        }

        // Now process each user for each date
        for (const user of users) {
            for (const date of datesToProcess) {
                const leaveKey = normalizeLeaveKey(user.name, user.client_name, date);
                const existing = canonicalLeaves.get(leaveKey);

                // If a human leave or blocked leave exists, never touch it
                if (existing && !isSystemAutoLeave(existing)) continue;
                if (existing && BLOCKED_LEAVE_TYPES.has(existing.leave_type)) continue;

                // Check if we should generate a leave
                const logKey = `${user.id}|${date}`;
                const dayLogs = logIndex.get(logKey) ?? [];

                // For today: only process if past shift end
                const isToday = date === today;
                if (isToday) {
                    const userNowMins = toZonedMinutes(now, user.timezone || 'America/Chicago');
                    const shiftEndMins = parseShiftMins(user.shift_end || '17:00');
                    if (userNowMins < shiftEndMins) continue; // shift not over yet
                }

                const { workedMs, hasPunchIn } = deriveWorkedMs(dayLogs);

                let target: {
                    date: string;
                    client_name: string;
                    employee_name: string;
                    is_planned: boolean;
                    reason: string;
                    approver: string;
                    leave_type: string;
                    day_count: number;
                } | null = null;

                if (!hasPunchIn) {
                    target = {
                        date,
                        client_name: user.client_name,
                        employee_name: user.name,
                        is_planned: false,
                        reason: `System Generated - no login found for the full shift.`,
                        approver: AUTO_LEAVE_APPROVER,
                        leave_type: 'System: Absent',
                        day_count: 1,
                    };
                } else if (workedMs < HALF_DAY_THRESHOLD_MS) {
                    target = {
                        date,
                        client_name: user.client_name,
                        employee_name: user.name,
                        is_planned: false,
                        reason: `System Generated - less than 4 hours logged (${Math.round(workedMs / 60000)}m worked).`,
                        approver: AUTO_LEAVE_APPROVER,
                        leave_type: 'System: Half-Day',
                        day_count: 0.5,
                    };
                }

                if (!target) {
                    // User worked enough — remove any system leave if it exists
                    if (existing && isSystemAutoLeave(existing)) {
                        const { error } = await supabaseServer
                            .from('leaves')
                            .delete()
                            .eq('id', existing.id);
                        if (error) {
                            summary.errors.push(`Failed to remove outdated leave for ${user.name}: ${error.message}`);
                        } else {
                            summary.leavesDeleted++;
                        }
                    }
                    continue;
                }

                if (existing && isSystemAutoLeave(existing)) {
                    // Update if different
                    const needsUpdate =
                        existing.leave_type !== target.leave_type ||
                        Number(existing.day_count) !== Number(target.day_count) ||
                        existing.reason !== target.reason;

                    if (needsUpdate) {
                        const { error } = await supabaseServer
                            .from('leaves')
                            .update(target)
                            .eq('id', existing.id);
                        if (error) {
                            summary.errors.push(`Failed to update leave for ${user.name}: ${error.message}`);
                        } else {
                            summary.leavesUpdated++;
                        }
                    }
                    continue;
                }

                // Insert new leave
                const { error } = await supabaseServer.from('leaves').insert(target);
                if (error) {
                    summary.errors.push(`Failed to insert leave for ${user.name}: ${error.message}`);
                } else {
                    summary.leavesCreated++;
                }
            }
        }
    } catch (err) {
        summary.errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
        return Response.json(summary, { status: 500 });
    }

    return Response.json({
        ...summary,
        success: summary.errors.length === 0,
        timestamp: new Date().toISOString(),
    });
}

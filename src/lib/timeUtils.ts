import { DaySession, BreakRecord, BRBRecord, TimeLog } from '@/types';

// ── Server Time Sync ─────────────────────────────────────────────────────────
// This stores the difference between the local OS clock and the authoritative Server time.
let clockOffsetMs = 0;

export function setServerOffset(serverMs: number) {
    clockOffsetMs = serverMs - Date.now();
}

/** Returns the local Date adjusted by the server drift. */
export function getRealDate(): Date {
    return new Date(Date.now() + clockOffsetMs);
}

/** Returns the current UTC timestamp adjusted by the server drift. */
export function getRealNow(): number {
    return Date.now() + clockOffsetMs;
}

// ── Shift policy defaults (used when user has no custom shift) ────────────────
export const BREAK_LIMIT_MS = 75 * 60 * 1000;  // 1h 15m max break/day
export const BREAK_ALLOWED_MS = 60 * 60 * 1000;  // 1h standard allowance
export const BRB_LIMIT_MS = 10 * 60 * 1000;  // 10m max BRB/day
export const COMBINED_LIMIT_MS = 85 * 60 * 1000;  // 1h 25m total max break

// Legacy constants kept for backward compat (reports use BREAK_LIMIT_MS etc.)
export const SHIFT_START_H = 8;
export const SHIFT_GRACE_MINS = 5;
export const SHIFT_END_H = 17;

/**
 * Convert a UTC timestamp to total minutes past midnight in a given IANA timezone.
 * Uses Intl.DateTimeFormat which correctly handles DST automatically.
 * e.g. America/Chicago is CST (-6) in winter and CDT (-5) in summer, transparently.
 */
export function toZonedMinutes(ts: number, timezone = 'America/Chicago'): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(ts));
    const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
    // hour12:false can return 24 for midnight
    return (h === 24 ? 0 : h) * 60 + m;
}

/** Convert "HH:MM" string to total minutes past midnight */
export function parseShiftMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/** @deprecated Use toZonedMinutes() instead. Kept for backward compat. */
export function toCSTTime(ts: number): { h: number; m: number } {
    const mins = toZonedMinutes(ts, 'America/Chicago');
    return { h: Math.floor(mins / 60), m: mins % 60 };
}

/** Total minutes past midnight in the given timezone */
function cstMinutes(ts: number) {
    return toZonedMinutes(ts, 'America/Chicago');
}

export function checkViolations(
    breakMs: number,
    brbMs: number,
    punchIn?: number,
    punchOut?: number,
    shiftStart = '08:00',
    shiftEnd = '17:00',
    timezone = 'America/Chicago',
) {
    const breakViolMs = Math.max(0, breakMs - BREAK_LIMIT_MS);
    const breakViol = breakViolMs > 0;
    const brbViolMs = Math.max(0, brbMs - BRB_LIMIT_MS);
    const brbViol = brbViolMs > 0;

    // Grace period: 5 minutes after shift start
    const graceCutoff = parseShiftMins(shiftStart) + 5;  // e.g. 08:00 → 485
    const shiftEndMin = parseShiftMins(shiftEnd);          // e.g. 17:00 → 1020

    let lateInMs = 0;
    let lateIn = false;
    if (punchIn) {
        const inMins = toZonedMinutes(punchIn, timezone);
        if (inMins > graceCutoff) {
            lateIn = true;
            lateInMs = (inMins - graceCutoff) * 60 * 1000;
        }
    }

    let earlyOutMs = 0;
    let earlyOut = false;
    if (punchOut) {
        const outMins = toZonedMinutes(punchOut, timezone);
        if (outMins < shiftEndMin) {
            earlyOut = true;
            earlyOutMs = (shiftEndMin - outMins) * 60 * 1000;
        }
    }

    return {
        breakViol,
        breakViolMs,
        brbViol,
        brbViolMs,
        lateIn,
        lateInMs,
        earlyOut,
        earlyOutMs,
        any: breakViol || brbViol || lateIn || earlyOut,
    };
}

export function formatDuration(ms: number): string {
    if (ms <= 0) return '0m';
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
}

export function getTodayKey(): string {
    return dateStr(getRealDate());
}

/** Returns the last N dates as ISO strings (YYYY-MM-DD), optionally skipping today */
export function getPastDaysZoned(count: number, excludeToday: boolean = true): string[] {
    const days: string[] = [];
    const offset = excludeToday ? 1 : 0;
    for (let i = 0; i < count; i++) {
        const d = getRealDate();
        d.setDate(d.getDate() - (i + offset));
        days.push(dateStr(d));
    }
    return days.reverse(); // oldest first
}

/** Given a YYYY-MM-DD string, returns a new YYYY-MM-DD string offset by N days */
export function getRelativeDate(baseDateStr: string, offsetDays: number): string {
    const d = new Date(baseDateStr + 'T12:00:00');
    d.setDate(d.getDate() + offsetDays);
    return dateStr(d);
}

/**
 * Returns the Mon–Fri date strings that have already elapsed for the current week.
 * - On Monday (no elapsed weekdays yet): falls back to last week's Mon–Fri.
 * - On Tuesday: returns [Monday].
 * - On Wednesday: returns [Monday, Tuesday].
 * - ...
 * - On Saturday/Sunday: returns full [Mon–Fri].
 * Used by Aura Maxxers & Lobby Campers for weekly-reset leaderboards.
 */
export function getElapsedWeekdays(): { days: string[]; isLastWeek: boolean } {
    const now = getRealDate();
    const cstParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const weekday = cstParts.find(p => p.type === 'weekday')!.value;
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[weekday] ?? 0;

    const todayY = parseInt(cstParts.find(p => p.type === 'year')!.value);
    const todayM = parseInt(cstParts.find(p => p.type === 'month')!.value) - 1;
    const todayD = parseInt(cstParts.find(p => p.type === 'day')!.value);
    const todayDate = new Date(todayY, todayM, todayD);

    // Find the most recent Monday
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;
    const thisMonday = new Date(todayDate);
    thisMonday.setDate(todayDate.getDate() - daysSinceMonday);

    let isLastWeek = false;
    let targetMonday = thisMonday;
    let daysToGenerate = 0;

    if (dow === 0 || dow === 1) {
        // Sunday or Monday -> Reset! Show last week's Mon-Fri
        isLastWeek = true;
        targetMonday = new Date(thisMonday);
        targetMonday.setDate(thisMonday.getDate() - 7);
        daysToGenerate = 5;
    } else if (dow === 6) {
        // Saturday -> Show this week's Mon-Fri
        daysToGenerate = 5;
    } else {
        // Tue (1 elapsed), Wed (2), Thu (3), Fri (4)
        daysToGenerate = dow - 1; 
    }

    const days: string[] = [];
    for (let i = 0; i < daysToGenerate; i++) {
        const d = new Date(targetMonday);
        d.setDate(targetMonday.getDate() + i);
        days.push(dateStr(d));
    }
    return { days, isLastWeek };
}

function pad(n: string | number) { return String(n).padStart(2, '0'); }

export function dateStr(d: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);

    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    return `${y}-${m}-${day}`;
}

export function yearMonthStr(d: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit'
    }).formatToParts(d);

    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    return `${y}-${m}`;
}

export function dayName(dateString: string): string {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export function isWorkDay(dateString: string): boolean {
    const day = new Date(dateString + 'T12:00:00').getDay();
    return day >= 1 && day <= 5; // Mon–Fri
}

export function computeSession(logs: TimeLog[]): DaySession {
    const session: DaySession = { breaks: [], brbs: [], logs };
    let breakStart: number | null = null;
    let brbStart: number | null = null;

    for (const log of logs) {
        switch (log.eventType) {
            case 'punch_in': session.punchIn = log.timestamp; break;
            case 'punch_out': session.punchOut = log.timestamp; break;
            case 'break_start': breakStart = log.timestamp; break;
            case 'break_end':
                if (breakStart !== null) { session.breaks.push({ start: breakStart, end: log.timestamp }); breakStart = null; }
                break;
            case 'brb_start': brbStart = log.timestamp; break;
            case 'brb_end':
                if (brbStart !== null) { session.brbs.push({ start: brbStart, end: log.timestamp }); brbStart = null; }
                break;
        }
    }
    if (breakStart !== null) session.breaks.push({ start: breakStart });
    if (brbStart !== null) session.brbs.push({ start: brbStart });
    return session;
}

export function computeTotalTime(records: (BreakRecord | BRBRecord)[], now: number): number {
    return records.reduce((acc, r) => acc + ((r.end ?? now) - r.start), 0);
}

export function computeWorkedTime(session: DaySession, now: number): number {
    if (!session.punchIn) return 0;
    const end = session.punchOut ?? now;
    const totalBreak = computeTotalTime(session.breaks, end); // use session end, not now, for closed sessions
    return Math.max(0, end - session.punchIn - totalBreak);
}

export function countBreaks(logs: TimeLog[]): number {
    return logs.filter((l) => l.eventType === 'break_start').length;
}

export function countBRBs(logs: TimeLog[]): number {
    return logs.filter((l) => l.eventType === 'brb_start').length;
}

export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}


export async function exportCSV(rows: (string | number)[][], filename: string = 'breakthrough-report') {
    const csv = rows
        .map((r) =>
            r.length === 0
                ? '' // blank line separator
                : r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
        )
        .join('\r\n');
    const bom = '\uFEFF';
    const finalFilename = `${filename}-${getTodayKey()}.csv`;
    await triggerDownload(bom + csv, finalFilename);
}

export async function exportExcel(rows: (string | number)[][], filename: string = 'breakthrough-data') {
    const csv = rows
        .map(r =>
            r.map(c => {
                const val = String(c ?? '');
                return val.includes(',') || val.includes('"') || val.includes('\n')
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
            }).join(',')
        )
        .join('\r\n');

    const bom = '\uFEFF';
    const finalFilename = `${filename}-${getTodayKey()}.csv`;
    await triggerDownload(bom + csv, finalFilename);
}

async function triggerDownload(content: string, filename: string) {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'CSV Spreadsheet',
                    accept: { 'text/csv': ['.csv'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return;
        } catch (err: any) {
            // AbortError means user cancelled the dialog
            if (err.name === 'AbortError') return;
            console.warn('showSaveFilePicker failed, falling back to legacy <a> download', err);
        }
    }

    const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = uri;
    a.setAttribute('download', filename);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

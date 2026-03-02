import { DaySession, BreakRecord, BRBRecord, TimeLog } from '@/types';

export const BREAK_LIMIT_MS = 75 * 60 * 1000;  // 1h 15m violation threshold
export const BRB_LIMIT_MS = 10 * 60 * 1000;  // 10m violation threshold

export function formatDuration(ms: number): string {
    if (ms <= 0) return '00m 00s';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

export function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
}

export function getTodayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function dateStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function yearMonthStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
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

export function checkViolations(breakMs: number, brbMs: number) {
    const breakViol = breakMs > BREAK_LIMIT_MS;
    const brbViol = brbMs > BRB_LIMIT_MS;
    return { breakViol, brbViol, any: breakViol || brbViol };
}

export function exportCSV(rows: (string | number)[][], filename: string = 'breakthrough-report'): void {
    const csv = rows
        .map((r) =>
            r.length === 0
                ? '' // blank line separator
                : r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
        )
        .join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${filename}-${getTodayKey()}.csv`);
}

export function exportExcel(rows: (string | number)[][], filename: string = 'breakthrough-data'): void {
    const tableRows = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    const html = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"></head>
      <body><table>${tableRows}</table></body>
    </html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${filename}-${getTodayKey()}.xls`);
}

function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

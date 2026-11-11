import { TimeLog } from '@/types';
import {
    computeSession,
    computeWorkedTime,
    computeTotalTime,
    countBreaks,
    countBRBs,
    checkViolations,
    dateStr,
    dayName,
    toZonedTimestamp,
    formatTimeNoSec,
    formatDurationHM,
    formatExceedHM,
    getRealNow,
} from './timeUtils';
import { PolicyConfigState, resolvePolicyForUser } from './policyConfig';

export interface DayRow {
    userId: string;
    name: string;
    clientName: string;
    date: string;
    punchIn?: number;
    punchOut?: number;
    workedMs: number;
    breakMs: number;
    brbMs: number;
    totalBreakMs: number;
    breakCount: number;
    brbCount: number;
    totalBreakCount: number;
    breakViol: boolean;
    breakViolMs: number;
    brbViol: boolean;
    brbViolMs: number;
    totalBreakViol: boolean;
    totalBreakViolMs: number;
    lateIn: boolean;
    lateInMs: number;
    earlyOut: boolean;
    earlyOutMs: number;
    autoLogout: boolean;
    anomalies: string[];
    hasAnomaly: boolean;
    combinedLimitMs: number;
}

export interface Summary {
    totalWorked: number;
    totalBreak: number;
    totalBrb: number;
    totalCombinedBreak: number;
    totalBreakCountSum: number;
    totalBreakEventsSum: number;
    totalBrbEventsSum: number;
    totalBreakViolMsSum: number;
    breakViolDays: number;
    brbViolDays: number;
    totalBreakViolDays: number;
    lateInDays: number;
    earlyOutDays: number;
    autoLogoutDays: number;
    anomalyDays: number;
    daysWorked: number;
    activeDays: number;
}

export interface RecruiterRollup {
    userId: string;
    name: string;
    clientName: string;
    activeDays: number;
    cleanDays: number;
    complianceRate: number;
    totalWorkedMs: number;
    avgWorkedPerDayMs: number;
    totalBreakCount: number;
    breakCount: number;
    brbCount: number;
    totalBreakMs: number;
    totalBrbMs: number;
    totalCombinedBreakMs: number;
    avgCombinedBreakPerDayMs: number;
    avgExceedPerDayMs: number;
    overallExceedMs: number;
    breakViolDays: number;
    brbViolDays: number;
    totalBreakViolDays: number;
    lateInDays: number;
    earlyOutDays: number;
    autoLogoutDays: number;
    anomalyDays: number;
    totalViolCount: number;
}

export interface ClientRollup {
    clientName: string;
    recruiterCount: number;
    activeDays: number;
    cleanDays: number;
    complianceRate: number;
    totalWorkedMs: number;
    avgWorkedPerDayMs: number;
    totalBreakCount: number;
    breakCount: number;
    brbCount: number;
    totalCombinedBreakMs: number;
    avgCombinedBreakPerDayMs: number;
    avgExceedPerDayMs: number;
    overallExceedMs: number;
    totalViolCount: number;
    anomalyDays: number;
}

export function processLogsIntoRow(
    userId: string,
    name: string,
    clientName: string,
    date: string,
    logs: TimeLog[],
    policyConfig: PolicyConfigState,
    userShiftStart = '08:00',
    userShiftEnd = '17:00',
    timezone = 'America/Chicago',
): DayRow {
    const policy = resolvePolicyForUser(policyConfig, clientName, userShiftStart, userShiftEnd);
    const session = computeSession(logs);
    const now = getRealNow();
    const todayStr = dateStr(new Date(now));

    let punchOut = session.punchOut;
    let calcEnd = punchOut ?? now;
    if (!punchOut && date < todayStr && session.punchIn) {
        const shiftEndTs = toZonedTimestamp(date, policy.shiftEnd, timezone);
        calcEnd = Math.max(session.punchIn, Math.min(now, shiftEndTs));
        punchOut = calcEnd;
    }

    const breakMs = computeTotalTime(session.breaks, calcEnd);
    const brbMs = computeTotalTime(session.brbs, calcEnd);
    const totalBreakMs = breakMs + brbMs;
    const breakCount = countBreaks(logs);
    const brbCount = countBRBs(logs);
    const totalBreakCount = breakCount + brbCount;
    const workedMs = computeWorkedTime({ ...session, punchOut }, now, date, policy.shiftEnd, timezone);

    const v = checkViolations(
        breakMs,
        brbMs,
        session.punchIn,
        punchOut,
        policy.shiftStart,
        policy.shiftEnd,
        timezone,
        logs,
        {
            breakLimitMs: policy.breakLimitMs,
            brbLimitMs: policy.brbLimitMs,
            combinedLimitMs: policy.combinedLimitMs,
            graceMins: policy.graceMins,
        },
    );

    const anomalies: string[] = [];
    if (workedMs === 0 && totalBreakMs > 0) {
        anomalies.push('Breaks w/o Active');
    }
    if (session.punchIn && punchOut && punchOut < session.punchIn) {
        anomalies.push('Inverted Punch');
    } else if (
        session.punchIn &&
        punchOut &&
        (punchOut - session.punchIn) < 5 * 60 * 1000 &&
        (totalBreakCount > 0 || !v.autoLogout)
    ) {
        anomalies.push('Micro-shift (<5m)');
    }
    if (session.punchIn && !session.punchOut && date < todayStr) {
        anomalies.push('Open Past Shift');
    }

    return {
        userId,
        name,
        clientName,
        date,
        punchIn: session.punchIn,
        punchOut,
        workedMs,
        breakMs,
        brbMs,
        totalBreakMs,
        breakCount,
        brbCount,
        totalBreakCount,
        breakViol: v.breakViol,
        breakViolMs: v.breakViolMs,
        brbViol: v.brbViol,
        brbViolMs: v.brbViolMs,
        totalBreakViol: v.totalBreakViol,
        totalBreakViolMs: v.totalBreakViolMs,
        lateIn: v.lateIn,
        lateInMs: v.lateInMs,
        earlyOut: v.earlyOut,
        earlyOutMs: v.earlyOutMs,
        autoLogout: v.autoLogout,
        anomalies,
        hasAnomaly: anomalies.length > 0,
        combinedLimitMs: policy.combinedLimitMs,
    };
}

export function summarizeRows(rows: DayRow[]): Summary {
    return rows.reduce<Summary>(
        (s, r) => ({
            totalWorked: s.totalWorked + r.workedMs,
            totalBreak: s.totalBreak + r.breakMs,
            totalBrb: s.totalBrb + r.brbMs,
            totalCombinedBreak: s.totalCombinedBreak + r.totalBreakMs,
            totalBreakCountSum: s.totalBreakCountSum + r.totalBreakCount,
            totalBreakEventsSum: s.totalBreakEventsSum + r.breakCount,
            totalBrbEventsSum: s.totalBrbEventsSum + r.brbCount,
            totalBreakViolMsSum: s.totalBreakViolMsSum + r.totalBreakViolMs,
            breakViolDays: s.breakViolDays + (r.breakViol ? 1 : 0),
            brbViolDays: s.brbViolDays + (r.brbViol ? 1 : 0),
            totalBreakViolDays: s.totalBreakViolDays + (r.totalBreakViol ? 1 : 0),
            lateInDays: s.lateInDays + (r.lateIn ? 1 : 0),
            earlyOutDays: s.earlyOutDays + (r.earlyOut ? 1 : 0),
            autoLogoutDays: s.autoLogoutDays + (r.autoLogout ? 1 : 0),
            anomalyDays: s.anomalyDays + (r.hasAnomaly ? 1 : 0),
            daysWorked: s.daysWorked + (r.workedMs > 0 ? 1 : 0),
            activeDays: s.activeDays + (r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0 ? 1 : 0),
        }),
        {
            totalWorked: 0,
            totalBreak: 0,
            totalBrb: 0,
            totalCombinedBreak: 0,
            totalBreakCountSum: 0,
            totalBreakEventsSum: 0,
            totalBrbEventsSum: 0,
            totalBreakViolMsSum: 0,
            breakViolDays: 0,
            brbViolDays: 0,
            totalBreakViolDays: 0,
            lateInDays: 0,
            earlyOutDays: 0,
            autoLogoutDays: 0,
            anomalyDays: 0,
            daysWorked: 0,
            activeDays: 0,
        },
    );
}

function isRowClean(r: DayRow): boolean {
    return !r.breakViol && !r.brbViol && !r.totalBreakViol && !r.lateIn && !r.earlyOut && !r.autoLogout;
}

export function buildRecruiterRollups(rows: DayRow[]): RecruiterRollup[] {
    const byUser = new Map<string, DayRow[]>();
    for (const r of rows) {
        const bucket = byUser.get(r.userId);
        if (bucket) bucket.push(r);
        else byUser.set(r.userId, [r]);
    }

    const rollups: RecruiterRollup[] = [];
    for (const [userId, uRows] of byUser.entries()) {
        const s = summarizeRows(uRows);
        const activeRows = uRows.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0);
        const activeDays = activeRows.length;
        const cleanDays = activeRows.filter(isRowClean).length;
        const denom = activeDays || 1;
        rollups.push({
            userId,
            name: uRows[0]?.name ?? 'Unknown',
            clientName: uRows[0]?.clientName ?? '',
            activeDays,
            cleanDays,
            complianceRate: activeDays > 0 ? Math.round((cleanDays / activeDays) * 100) : 100,
            totalWorkedMs: s.totalWorked,
            avgWorkedPerDayMs: s.totalWorked / denom,
            totalBreakCount: s.totalBreakCountSum,
            breakCount: s.totalBreakEventsSum,
            brbCount: s.totalBrbEventsSum,
            totalBreakMs: s.totalBreak,
            totalBrbMs: s.totalBrb,
            totalCombinedBreakMs: s.totalCombinedBreak,
            avgCombinedBreakPerDayMs: s.totalCombinedBreak / denom,
            avgExceedPerDayMs: s.totalBreakViolMsSum / denom,
            overallExceedMs: s.totalBreakViolMsSum,
            breakViolDays: s.breakViolDays,
            brbViolDays: s.brbViolDays,
            totalBreakViolDays: s.totalBreakViolDays,
            lateInDays: s.lateInDays,
            earlyOutDays: s.earlyOutDays,
            autoLogoutDays: s.autoLogoutDays,
            anomalyDays: s.anomalyDays,
            totalViolCount:
                s.breakViolDays + s.brbViolDays + s.totalBreakViolDays + s.lateInDays + s.earlyOutDays + s.autoLogoutDays,
        });
    }

    return rollups.sort((a, b) => b.overallExceedMs - a.overallExceedMs || a.name.localeCompare(b.name));
}

export function buildClientRollups(rows: DayRow[]): ClientRollup[] {
    const byClient = new Map<string, DayRow[]>();
    for (const r of rows) {
        const client = r.clientName || 'Unassigned';
        const bucket = byClient.get(client);
        if (bucket) bucket.push(r);
        else byClient.set(client, [r]);
    }

    const rollups: ClientRollup[] = [];
    for (const [clientName, cRows] of byClient.entries()) {
        const s = summarizeRows(cRows);
        const activeRows = cRows.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0);
        const activeDays = activeRows.length;
        const cleanDays = activeRows.filter(isRowClean).length;
        const denom = activeDays || 1;
        const recruiterCount = new Set(cRows.map(r => r.userId)).size;
        rollups.push({
            clientName,
            recruiterCount,
            activeDays,
            cleanDays,
            complianceRate: activeDays > 0 ? Math.round((cleanDays / activeDays) * 100) : 100,
            totalWorkedMs: s.totalWorked,
            avgWorkedPerDayMs: s.totalWorked / denom,
            totalBreakCount: s.totalBreakCountSum,
            breakCount: s.totalBreakEventsSum,
            brbCount: s.totalBrbEventsSum,
            totalCombinedBreakMs: s.totalCombinedBreak,
            avgCombinedBreakPerDayMs: s.totalCombinedBreak / denom,
            avgExceedPerDayMs: s.totalBreakViolMsSum / denom,
            overallExceedMs: s.totalBreakViolMsSum,
            totalViolCount:
                s.breakViolDays + s.brbViolDays + s.totalBreakViolDays + s.lateInDays + s.earlyOutDays + s.autoLogoutDays,
            anomalyDays: s.anomalyDays,
        });
    }

    return rollups.sort((a, b) => b.overallExceedMs - a.overallExceedMs || a.clientName.localeCompare(b.clientName));
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function openPrintableScorecard(
    recruiterName: string,
    clientName: string,
    rangeLabel: string,
    rows: DayRow[],
): boolean {
    if (typeof window === 'undefined') return false;
    const w = window.open('', '_blank', 'width=1024,height=760');
    if (!w) return false;

    const s = summarizeRows(rows);
    const activeRows = rows.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0);
    const activeDays = activeRows.length;
    const cleanDays = activeRows.filter(isRowClean).length;
    const complianceRate = activeDays > 0 ? Math.round((cleanDays / activeDays) * 100) : 100;
    const denom = activeDays || 1;
    const avgCombined = s.totalCombinedBreak / denom;
    const avgExceed = s.totalBreakViolMsSum / denom;

    const tableRowsHtml = [...rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => {
            const flags: string[] = [];
            if (r.breakViol) flags.push(`Break (${formatExceedHM(r.breakViolMs)})`);
            if (r.brbViol) flags.push(`BRB (${formatExceedHM(r.brbViolMs)})`);
            if (r.totalBreakViol) flags.push(`Brk+BRB (+${formatExceedHM(r.totalBreakViolMs)})`);
            if (r.lateIn) flags.push(`Late (${formatExceedHM(r.lateInMs)})`);
            if (r.earlyOut) flags.push(`Early (${formatExceedHM(r.earlyOutMs)})`);
            if (r.autoLogout) flags.push('Auto Out');
            if (r.hasAnomaly) flags.push(`Audit: ${r.anomalies.join(', ')}`);

            return `
                <tr>
                    <td>${escapeHtml(r.date)} (${escapeHtml(dayName(r.date))})</td>
                    <td>${r.punchIn ? escapeHtml(formatTimeNoSec(r.punchIn)) : '—'}</td>
                    <td>${r.punchOut ? escapeHtml(formatTimeNoSec(r.punchOut)) : r.punchIn ? 'ACTIVE' : '—'}</td>
                    <td><strong>${r.workedMs > 0 ? escapeHtml(formatDurationHM(r.workedMs)) : '—'}</strong></td>
                    <td>${r.totalBreakCount > 0 ? `${r.totalBreakCount} (${r.breakCount}B + ${r.brbCount}R)` : '0'}</td>
                    <td>${r.totalBreakMs > 0 ? escapeHtml(formatDurationHM(r.totalBreakMs)) : '—'}</td>
                    <td style="color:${r.totalBreakViol ? '#b91c1c' : '#334155'};font-weight:${r.totalBreakViol ? '700' : '400'}">
                        ${r.totalBreakViol ? `+${escapeHtml(formatExceedHM(r.totalBreakViolMs))}` : '—'}
                    </td>
                    <td>${flags.length ? escapeHtml(flags.join(' · ')) : '<span style="color:#047857;font-weight:600">Clean</span>'}</td>
                </tr>
            `;
        })
        .join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Scorecard - ${escapeHtml(recruiterName)} (${escapeHtml(rangeLabel)})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 28px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
    .title { font-size: 20px; font-weight: 800; margin: 0; }
    .sub { font-size: 12px; color: #475569; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; }
    .card-val { font-size: 18px; font-weight: 800; margin-top: 4px; color: #0f172a; }
    .card-sub { font-size: 11px; color: #475569; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; background: #f1f5f9; }
    .footer { margin-top: 16px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
    @media print { body { margin: 14px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">Brigade Pulse — Attendance & Break Scorecard</h1>
      <div class="sub">Recruiter: <strong>${escapeHtml(recruiterName)}</strong> · Client: <strong>${escapeHtml(clientName || 'N/A')}</strong> · Period: <strong>${escapeHtml(rangeLabel)}</strong></div>
    </div>
    <div class="sub">Generated ${escapeHtml(new Date().toLocaleDateString('en-US'))}</div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="card-label">Net Active Total</div>
      <div class="card-val">${escapeHtml(formatDurationHM(s.totalWorked))}</div>
      <div class="card-sub">${activeDays} active days · Avg ${escapeHtml(formatDurationHM(s.totalWorked / denom))}/d</div>
    </div>
    <div class="card">
      <div class="card-label">Total Breaks & Time</div>
      <div class="card-val">${s.totalBreakCountSum} breaks · ${escapeHtml(formatDurationHM(s.totalCombinedBreak))}</div>
      <div class="card-sub">${s.totalBreakEventsSum} Break (${escapeHtml(formatDurationHM(s.totalBreak))}) · ${s.totalBrbEventsSum} BRB (${escapeHtml(formatDurationHM(s.totalBrb))})</div>
    </div>
    <div class="card">
      <div class="card-label">Overall Break Exceed</div>
      <div class="card-val" style="color:${s.totalBreakViolMsSum > 0 ? '#b91c1c' : '#047857'}">${s.totalBreakViolMsSum > 0 ? `+${escapeHtml(formatExceedHM(s.totalBreakViolMsSum))}` : '0m'}</div>
      <div class="card-sub">Avg Brk+BRB ${escapeHtml(formatDurationHM(avgCombined))}/d · Avg Exceed ${avgExceed > 0 ? `+${escapeHtml(formatExceedHM(avgExceed))}/d` : '0m/d'}</div>
    </div>
    <div class="card">
      <div class="card-label">Compliance Health</div>
      <div class="card-val">${complianceRate}% Clean</div>
      <div class="card-sub">Late ${s.lateInDays}d · Brk+BRB ${s.totalBreakViolDays}d · AutoOut ${s.autoLogoutDays}d</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Arrival</th><th>Departure</th><th>Net Active</th><th>Total Breaks</th><th>Brk + BRB</th><th>Exceed</th><th>Compliance / Audit</th>
      </tr>
    </thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>
  <div class="footer">
    <span>Report generated without seconds; exceed intervals >= 1h shown in hours & minutes.</span>
    <span>Brigade Pulse Admin Unit</span>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
}

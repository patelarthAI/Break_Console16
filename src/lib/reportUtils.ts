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
    expectedWorkedMs: number;
    workedVarianceMs: number;
    cleanBreakDays: number;
    breakComplianceRate: number;
    punctualityRate: number;
}

export interface RecruiterRollup {
    userId: string;
    name: string;
    clientName: string;
    activeDays: number;
    cleanDays: number;
    complianceRate: number;
    cleanBreakDays: number;
    breakComplianceRate: number;
    punctualityRate: number;
    totalWorkedMs: number;
    expectedWorkedMs: number;
    workedVarianceMs: number;
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
    cleanBreakDays: number;
    breakComplianceRate: number;
    totalWorkedMs: number;
    expectedWorkedMs: number;
    workedVarianceMs: number;
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
    const base = rows.reduce(
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

    const expectedWorkedMs = base.activeDays * 8 * 60 * 60 * 1000;
    const workedVarianceMs = base.totalWorked - expectedWorkedMs;
    const cleanBreakDays = Math.max(0, base.activeDays - base.totalBreakViolDays);
    const breakComplianceRate = base.activeDays > 0 ? Math.round((cleanBreakDays / base.activeDays) * 100) : 100;
    const punctualityRate = base.activeDays > 0 ? Math.round((Math.max(0, base.activeDays - base.lateInDays) / base.activeDays) * 100) : 100;

    return {
        ...base,
        expectedWorkedMs,
        workedVarianceMs,
        cleanBreakDays,
        breakComplianceRate,
        punctualityRate,
    };
}

export function isRowClean(r: DayRow): boolean {
    // True disciplinary violation: exceeded breaks, arrived late, or left early without authorization
    return !r.breakViol && !r.brbViol && !r.totalBreakViol && !r.lateIn && !r.earlyOut && !r.hasAnomaly;
}

export function isRowBreakClean(r: DayRow): boolean {
    return !r.breakViol && !r.brbViol && !r.totalBreakViol;
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
        const cleanBreakDays = activeRows.filter(isRowBreakClean).length;
        const denom = activeDays || 1;
        const breakComplianceRate = activeDays > 0 ? Math.round((cleanBreakDays / activeDays) * 100) : 100;
        const punctualityRate = activeDays > 0 ? Math.round((Math.max(0, activeDays - s.lateInDays) / activeDays) * 100) : 100;
        const complianceRate = activeDays > 0 ? Math.round((cleanDays / activeDays) * 100) : 100;
        const expectedWorkedMs = activeDays * 8 * 60 * 60 * 1000;
        const workedVarianceMs = s.totalWorked - expectedWorkedMs;

        rollups.push({
            userId,
            name: uRows[0]?.name ?? 'Unknown',
            clientName: uRows[0]?.clientName ?? '',
            activeDays,
            cleanDays,
            complianceRate,
            cleanBreakDays,
            breakComplianceRate,
            punctualityRate,
            totalWorkedMs: s.totalWorked,
            expectedWorkedMs,
            workedVarianceMs,
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
        const cleanBreakDays = activeRows.filter(isRowBreakClean).length;
        const denom = activeDays || 1;
        const recruiterCount = new Set(cRows.map(r => r.userId)).size;
        const breakComplianceRate = activeDays > 0 ? Math.round((cleanBreakDays / activeDays) * 100) : 100;
        const complianceRate = activeDays > 0 ? Math.round((cleanDays / activeDays) * 100) : 100;
        const expectedWorkedMs = activeDays * 8 * 60 * 60 * 1000;
        const workedVarianceMs = s.totalWorked - expectedWorkedMs;

        rollups.push({
            clientName,
            recruiterCount,
            activeDays,
            cleanDays,
            complianceRate,
            cleanBreakDays,
            breakComplianceRate,
            totalWorkedMs: s.totalWorked,
            expectedWorkedMs,
            workedVarianceMs,
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
    const w = window.open('', '_blank', 'width=1120,height=820');
    if (!w) return false;

    const s = summarizeRows(rows);
    const activeRows = rows.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0);
    const activeDays = activeRows.length;
    const denom = activeDays || 1;
    const avgCombined = s.totalCombinedBreak / denom;
    const avgExceed = s.totalBreakViolMsSum / denom;

    const tableRowsHtml = [...rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => {
            const shiftTargetMs = 8 * 3600000;
            const varianceMs = r.workedMs - shiftTargetMs;
            const varianceSign = varianceMs >= 0 ? '+' : '-';
            const varianceText = r.workedMs > 0 ? `${varianceSign}${formatDurationHM(Math.abs(varianceMs))}` : '—';
            const budgetLimitMs = r.combinedLimitMs || 85 * 60000;
            const underBudgetMs = Math.max(0, budgetLimitMs - r.totalBreakMs);

            const statusBadges: string[] = [];
            if (r.totalBreakViol) {
                statusBadges.push(`<span class="badge badge-rose">Brk+BRB (+${escapeHtml(formatExceedHM(r.totalBreakViolMs))})</span>`);
            } else if (r.breakViol) {
                statusBadges.push(`<span class="badge badge-amber">Break (+${escapeHtml(formatExceedHM(r.breakViolMs))})</span>`);
            } else if (r.brbViol) {
                statusBadges.push(`<span class="badge badge-amber">BRB (+${escapeHtml(formatExceedHM(r.brbViolMs))})</span>`);
            }
            if (r.lateIn) {
                statusBadges.push(`<span class="badge badge-amber">Late In (+${escapeHtml(formatExceedHM(r.lateInMs))})</span>`);
            }
            if (r.earlyOut) {
                statusBadges.push(`<span class="badge badge-purple">Early Out (-${escapeHtml(formatExceedHM(r.earlyOutMs))})</span>`);
            }
            if (r.autoLogout) {
                statusBadges.push(`<span class="badge badge-slate">Auto Out Safeguard</span>`);
            }
            if (r.hasAnomaly) {
                statusBadges.push(`<span class="badge badge-rose">Audit: ${escapeHtml(r.anomalies.join(', '))}</span>`);
            }
            if (statusBadges.length === 0) {
                statusBadges.push(`<span class="badge badge-emerald">Clean Shift</span>`);
            }

            return `
                <tr>
                    <td class="font-mono">
                        <strong>${escapeHtml(r.date)}</strong>
                        <span class="day-sub">(${escapeHtml(dayName(r.date))})</span>
                    </td>
                    <td class="font-mono">
                        ${r.punchIn ? escapeHtml(formatTimeNoSec(r.punchIn)) : '—'}
                        <span class="sep">→</span>
                        ${r.punchOut ? escapeHtml(formatTimeNoSec(r.punchOut)) : r.punchIn ? '<strong class="text-sky">ACTIVE</strong>' : '—'}
                    </td>
                    <td class="font-mono">
                        <strong>${r.workedMs > 0 ? escapeHtml(formatDurationHM(r.workedMs)) : '—'}</strong>
                        ${r.workedMs > 0 ? `<span class="var-sub ${varianceMs >= 0 ? 'text-emerald' : 'text-slate'}">(${varianceText})</span>` : ''}
                    </td>
                    <td class="font-mono">
                        ${r.totalBreakCount > 0 ? `<strong>${r.totalBreakCount}</strong> <span class="break-sub">(${r.breakCount}B + ${r.brbCount}R) · ${escapeHtml(formatDurationHM(r.totalBreakMs))}</span>` : '0'}
                    </td>
                    <td class="font-mono">
                        ${r.totalBreakMs > 0 ? `${escapeHtml(formatDurationHM(r.totalBreakMs))} / ${escapeHtml(formatDurationHM(budgetLimitMs))}` : '0m'}
                        <span class="day-sub">${underBudgetMs > 0 ? `(${formatDurationHM(underBudgetMs)} under)` : ''}</span>
                    </td>
                    <td class="font-mono ${r.totalBreakViol ? 'text-rose font-bold' : 'text-slate'}">
                        ${r.totalBreakViol ? `+${escapeHtml(formatExceedHM(r.totalBreakViolMs))}` : '0m'}
                    </td>
                    <td>
                        <div class="badge-cluster">${statusBadges.join(' ')}</div>
                    </td>
                </tr>
            `;
        })
        .join('');

    const varianceSign = s.workedVarianceMs >= 0 ? '+' : '-';
    const varianceFormatted = `${varianceSign}${formatDurationHM(Math.abs(s.workedVarianceMs))}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Executive Scorecard — ${escapeHtml(recruiterName)} (${escapeHtml(rangeLabel)})</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 32px 36px;
      line-height: 1.45;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-sub {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #475569;
      font-weight: 700;
      margin-top: 3px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .meta-box strong { color: #0f172a; }
    .recruiter-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 20px;
    }
    .recruiter-profile {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar-cube {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #0f172a;
      color: #ffffff;
      font-size: 17px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .recruiter-name {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .recruiter-client {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }
    .recruiter-period {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .pillar-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    .pillar-card {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 14px 16px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .pillar-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #475569;
      font-weight: 800;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .pillar-val {
      font-size: 24px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .pillar-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 6px;
      line-height: 1.4;
    }
    .pillar-sub strong { color: #0f172a; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 24px;
    }
    thead th {
      background: #f1f5f9;
      border-bottom: 2px solid #cbd5e1;
      padding: 9px 8px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #334155;
      font-weight: 800;
    }
    tbody td {
      border-bottom: 1px solid #e2e8f0;
      padding: 9px 8px;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) { background: #fafbfc; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .day-sub { font-size: 10px; color: #64748b; margin-left: 4px; font-family: sans-serif; }
    .break-sub { font-size: 10px; color: #64748b; font-family: sans-serif; }
    .sep { color: #94a3b8; margin: 0 4px; font-weight: 400; }
    .var-sub { font-size: 10px; margin-left: 4px; font-family: sans-serif; font-weight: 600; }
    .badge-cluster { display: flex; flex-wrap: wrap; gap: 4px; }
    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-emerald { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge-amber { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .badge-rose { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
    .badge-purple { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .badge-slate { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .text-emerald { color: #047857; }
    .text-rose { color: #be123c; }
    .text-amber { color: #b45309; }
    .text-sky { color: #0284c7; }
    .text-slate { color: #64748b; }
    .signoff-section {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      margin-top: 10px;
    }
    .signoff-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #334155;
      margin-bottom: 8px;
    }
    .signoff-summary {
      font-size: 12px;
      color: #475569;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      padding-top: 14px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-line {
      border-bottom: 1px solid #0f172a;
      height: 28px;
      margin-bottom: 6px;
    }
    .sig-label {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }
    @page { margin: 12mm 14mm; size: letter; }
    @media print {
      body { padding: 0; }
      .signoff-section { break-inside: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="brand-title">BRIGADE PULSE</div>
      <div class="brand-sub">Executive Attendance &amp; Break Discipline Scorecard</div>
    </div>
    <div class="meta-box">
      <div>Report Status: <strong>Verified Admin Audit</strong></div>
      <div>Generated: <strong>${escapeHtml(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}</strong></div>
      <div>Unit: <strong>Interactive Manpower Solutions</strong></div>
    </div>
  </div>

  <div class="recruiter-strip">
    <div class="recruiter-profile">
      <div class="avatar-cube">${escapeHtml(recruiterName[0]?.toUpperCase() || 'R')}</div>
      <div>
        <div class="recruiter-name">${escapeHtml(recruiterName)}</div>
        <div class="recruiter-client">Client Account: <strong>${escapeHtml(clientName || 'Unassigned')}</strong></div>
      </div>
    </div>
    <div class="recruiter-period">
      <div>Assessment Period: <strong>${escapeHtml(rangeLabel)}</strong></div>
      <div>Active Shift Days: <strong>${activeDays} Days Recorded</strong></div>
    </div>
  </div>

  <div class="pillar-grid">
    <!-- Pillar 1: Production -->
    <div class="pillar-card">
      <div class="pillar-label">
        <span>Shift Production</span>
        <span class="${s.workedVarianceMs >= 0 ? 'text-emerald' : 'text-slate'} font-mono">${varianceFormatted}</span>
      </div>
      <div class="pillar-val">${escapeHtml(formatDurationHM(s.totalWorked))}</div>
      <div class="pillar-sub">
        Standard Target: <strong>${escapeHtml(formatDurationHM(s.expectedWorkedMs))}</strong> (${activeDays}d × 8h)<br/>
        Daily Average: <strong>${escapeHtml(formatDurationHM(s.totalWorked / denom))}/day</strong>
      </div>
    </div>

    <!-- Pillar 2: Break Discipline -->
    <div class="pillar-card">
      <div class="pillar-label">
        <span>Break Discipline</span>
        <span class="${s.totalBreakViolMsSum > 0 ? 'text-rose' : 'text-emerald'} font-mono">${s.breakComplianceRate}% Clean</span>
      </div>
      <div class="pillar-val" style="color:${s.totalBreakViolMsSum > 0 ? '#be123c' : '#047857'}">
        ${s.totalBreakViolMsSum > 0 ? `+${escapeHtml(formatExceedHM(s.totalBreakViolMsSum))}` : '0m Exceed'}
      </div>
      <div class="pillar-sub">
        Total Brk+BRB: <strong>${escapeHtml(formatDurationHM(s.totalCombinedBreak))}</strong> (${s.totalBreakCountSum} breaks)<br/>
        Daily Avg: <strong>${escapeHtml(formatDurationHM(avgCombined))}/d</strong> (Allowed: 1h 25m budget)
      </div>
    </div>

    <!-- Pillar 3: Punctuality -->
    <div class="pillar-card">
      <div class="pillar-label">
        <span>Punctuality &amp; Timekeeping</span>
        <span class="text-sky font-mono">${s.punctualityRate}% On-Time</span>
      </div>
      <div class="pillar-val">${activeDays - s.lateInDays}/${activeDays} Days</div>
      <div class="pillar-sub">
        Late Logins: <strong>${s.lateInDays}</strong> · Early Departures: <strong>${s.earlyOutDays}</strong><br/>
        Auto-Out Safeguards: <strong>${s.autoLogoutDays}</strong> · Anomalies: <strong>${s.anomalyDays}</strong>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:130px">Date &amp; Day</th>
        <th style="width:145px">Punch Shift</th>
        <th style="width:110px">Net Active</th>
        <th style="width:140px">Breaks Taken</th>
        <th style="width:130px">Combined vs Budget</th>
        <th style="width:90px">Exceed</th>
        <th>Audit Assessment</th>
      </tr>
    </thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>

  <div class="signoff-section">
    <div class="signoff-title">Performance Summary &amp; Leadership Audit</div>
    <div class="signoff-summary">
      <strong>Recruiter Assessment:</strong> ${escapeHtml(recruiterName)} completed ${activeDays} active shift days with a cumulative worked duration of ${escapeHtml(formatDurationHM(s.totalWorked))} (variance: ${varianceFormatted} vs standard 8h/day benchmark).
      Break discipline score is <strong>${s.breakComplianceRate}% Clean</strong> with <strong>${s.totalBreakViolMsSum > 0 ? `+${formatExceedHM(s.totalBreakViolMsSum)} total exceed` : 'zero break exceed time'}</strong>.
      Punctuality on morning logins stands at <strong>${s.punctualityRate}% on-time</strong>.
      ${s.autoLogoutDays > 0 ? `Note: ${s.autoLogoutDays} shift(s) closed via automated 4:50 PM safeguard; recruiter reminded to manually punch out at shift departure.` : ''}
    </div>
    <div class="signature-grid">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Recruiter Signature &amp; Date (${escapeHtml(recruiterName)})</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Reporting Manager / Team Lead Signature &amp; Date</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Brigade Pulse Audit Unit · Accurate to minute (zero seconds) · Exceed ≥ 1h shown in Xh Ym</span>
    <span>Confidential Recruiter Performance Record</span>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
}

    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
}

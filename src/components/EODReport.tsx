'use client';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Table2, ChevronDown, ChevronUp } from 'lucide-react';
import { TimeLog } from '@/types';
import { computeSession, computeTotalTime, computeWorkedTime, countBreaks, countBRBs, formatDuration, formatTime, exportCSV } from '@/lib/timeUtils';

interface Props { logs: TimeLog[]; userName: string; }

export default function EODReport({ logs, userName }: Props) {
    const [open, setOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const now = Date.now();
    const session = computeSession(logs);
    const workedMs = computeWorkedTime(session, now);
    const breakMs = computeTotalTime(session.breaks, now);
    const brbMs = computeTotalTime(session.brbs, now);
    const numBreaks = countBreaks(logs);
    const numBRBs = countBRBs(logs);

    const eventLabel: Record<string, string> = {
        punch_in: 'Punch In', punch_out: 'Punch Out',
        break_start: 'Break In', break_end: 'Break Out',
        brb_start: 'BRB In', brb_end: 'BRB Out',
    };
    const rows = logs.map((l) => ({ label: eventLabel[l.eventType] ?? l.eventType, time: formatTime(l.timestamp) }));

    const handleCSV = useCallback(() => {
        exportCSV([
            ['Event', 'Time'],
            ...rows.map((r) => [r.label, r.time]),
            [],
            ['--- Summary ---', ''],
            ['Total Worked', formatDuration(workedMs)],
            ['Total Break', formatDuration(breakMs)],
            ['Break Count', String(numBreaks)],
            ['Total BRB', formatDuration(brbMs)],
            ['BRB Count', String(numBRBs)],
            ['Recruiter', userName],
        ] as string[][]);
    }, [rows, workedMs, breakMs, brbMs, numBreaks, numBRBs, userName]);

    const handlePDF = useCallback(async () => {
        setPdfLoading(true);
        try {
            const jsPDFModule = await import('jspdf');
            const jsPDFClass = jsPDFModule.default || (jsPDFModule as any).jsPDF;
            const doc = new jsPDFClass({ unit: 'mm', format: 'a4' });
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Header
            doc.setFillColor(26, 26, 46); doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
            doc.text('Daily Punch Report', 15, 18);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 200);
            doc.text(`Recruiter: ${userName}`, 15, 27);
            doc.text(`Date: ${today}`, 15, 34);

            // Events table
            doc.setTextColor(0); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
            doc.text('Event Log', 15, 52);
            let y = 58;
            doc.setFillColor(59, 130, 246); doc.rect(15, y, 160, 8, 'F');
            doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.text('Event', 18, y + 5.5); doc.text('Time', 100, y + 5.5);
            y += 8;
            rows.forEach((row, i) => {
                doc.setFillColor(i % 2 === 0 ? 242 : 250, i % 2 === 0 ? 244 : 252, 255);
                doc.rect(15, y, 160, 7, 'F');
                doc.setTextColor(40, 40, 60); doc.setFont('helvetica', 'normal');
                doc.text(row.label, 18, y + 5); doc.text(row.time, 100, y + 5);
                y += 7;
            });

            // Summary
            y += 10;
            doc.setFillColor(26, 26, 46); doc.roundedRect(15, y, 180, 50, 3, 3, 'F');
            doc.setTextColor(255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
            doc.text('Daily Summary', 20, y + 9);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            doc.text(`Total Worked:    ${formatDuration(workedMs)}`, 20, y + 19);
            doc.text(`Total Break:     ${formatDuration(breakMs)}  (${numBreaks} break${numBreaks !== 1 ? 's' : ''})`, 20, y + 28);
            doc.text(`Total BRB:       ${formatDuration(brbMs)}  (${numBRBs} BRB${numBRBs !== 1 ? 's' : ''})`, 20, y + 37);

            doc.save(`punch-report-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) { console.error(e); }
        finally { setPdfLoading(false); }
    }, [rows, workedMs, breakMs, brbMs, numBreaks, numBRBs, userName]);

    return (
        <div className="glass-card-inner rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-electric" />
                    <span className="font-bold text-white text-sm">Daily Summary Report</span>
                </div>
                {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
            </button>

            {open && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-white/10 p-4 space-y-4">
                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Worked', value: formatDuration(workedMs), color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-500/30' },
                            { label: `Break ×${numBreaks}`, value: formatDuration(breakMs), color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-500/30' },
                            { label: `BRB ×${numBRBs}`, value: formatDuration(brbMs), color: 'text-violet-400', bg: 'bg-violet-900/30 border-violet-500/30' },
                        ].map((s) => (
                            <div key={s.label} className={`border rounded-xl p-2.5 text-center ${s.bg}`}>
                                <p className="text-xs text-slate-400 mb-0.5">{s.label}</p>
                                <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Table */}
                    {logs.length > 0 && (
                        <div className="rounded-xl overflow-hidden border border-white/10">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-electric/20 text-xs font-bold text-slate-300">
                                        <th className="py-2 px-3 text-left">Event</th>
                                        <th className="py-2 px-3 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, i) => (
                                        <tr key={i} style={i % 2 === 0 ? { background: 'rgba(255,255,255,0.03)' } : {}}>
                                            <td className="py-2 px-3 text-white">{row.label}</td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-400 text-xs">{row.time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!logs.length && <p className="text-center text-slate-500 text-sm py-3">No events yet.</p>}

                    {/* Export */}
                    <div className="grid grid-cols-2 gap-2">
                        <motion.button onClick={handlePDF} disabled={pdfLoading || !logs.length} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-electric/20 border border-electric/30 text-electric text-sm font-semibold hover:bg-electric/30 transition-all disabled:opacity-40">
                            {pdfLoading ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> : <Download size={14} />}
                            PDF
                        </motion.button>
                        <motion.button onClick={handleCSV} disabled={!logs.length} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-40">
                            <Table2 size={14} /> CSV
                        </motion.button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

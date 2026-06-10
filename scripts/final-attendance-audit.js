const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper for timezone-aware date string
function dateStr(ts, timezone = 'America/Chicago') {
    const d = new Date(ts);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${day}`;
}

async function runAudit() {
    console.log("=== STARTING DEEP ATTENDANCE AUDIT ===");
    
    // 1. Fetch all users to know their timezones
    const { data: users } = await supabase.from('users').select('*');
    const userMap = Object.fromEntries(users.map(u => [u.name + '||' + u.client_name, u]));
    const idToUser = Object.fromEntries(users.map(u => [u.id, u]));

    // 2. Fetch all "System" leaves
    const { data: systemLeaves } = await supabase.from('leaves')
        .select('*')
        .ilike('leave_type', 'System%');

    if (!systemLeaves || systemLeaves.length === 0) {
        console.log("No stored 'System' leaves found in database.");
    } else {
        console.log(`Found ${systemLeaves.length} stored 'System' leaves. Checking for contradictions...`);
        
        let deletedCount = 0;
        for (const leave of systemLeaves) {
            const user = userMap[leave.employee_name + '||' + leave.client_name];
            if (!user) continue;

            // Check if there are logs on this date for this user
            // We check the 'time_logs' table for entries on this 'date' key
            const { data: logs } = await supabase.from('time_logs')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', leave.date);

            if (logs && logs.length > 0) {
                console.log(`[CONTRADICTION] ${leave.employee_name} on ${leave.date}: Found ${logs.length} logs but marked as ${leave.leave_type}.`);
                const { error } = await supabase.from('leaves').delete().eq('id', leave.id);
                if (!error) {
                    console.log(`  -> Successfully deleted invalid leave record.`);
                    deletedCount++;
                } else {
                    console.log(`  -> FAILED to delete: ${error.message}`);
                }
            }
        }
        console.log(`Audit complete. Removed ${deletedCount} incorrect stored records.`);
    }

    // 3. Check for MIS-DATE-TAGGED logs (Historical correction)
    // Sometimes logs were saved with the wrong 'date' string due to server-side mismatches before my fix.
    console.log("\nChecking for logs with incorrect 'date' tags (timezone correction)...");
    const { data: recentLogs } = await supabase.from('time_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(3000);

    let logsFixed = 0;
    for (const log of recentLogs) {
        const user = idToUser[log.user_id];
        if (!user) continue;

        const correctDate = dateStr(log.timestamp, user.timezone || 'America/Chicago');
        if (log.date !== correctDate) {
            console.log(`[MISALIGN] Log ${log.id} (${user.name}): Stored as ${log.date}, should be ${correctDate}`);
            const { error } = await supabase.from('time_logs').update({ date: correctDate }).eq('id', log.id);
            if (!error) {
                logsFixed++;
            }
        }
    }
    console.log(`Re-keyed ${logsFixed} logs to correct local dates.`);
    console.log("=== AUDIT AND SYNC COMPLETE ===");
}

runAudit();

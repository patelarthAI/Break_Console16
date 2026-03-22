const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified dateStr logic from timeUtils.ts
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

async function run() {
    console.log("Analyzing logs for date-timezone misalignment...");
    
    const { data: users } = await supabase.from('users').select('*');
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Fetch recent logs (last 7 days)
    const { data: logs } = await supabase.from('time_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(2000);

    if (!logs) return;

    let updatedCount = 0;
    for (const log of logs) {
        const user = userMap[log.user_id];
        if (!user) continue;

        const correctDate = dateStr(log.timestamp, user.timezone || 'America/Chicago');
        
        if (log.date !== correctDate) {
            console.log(`MISMATCH: User ${user.name} log at ${new Date(log.timestamp).toISOString()}`);
            console.log(`  Stored: ${log.date} | Should be: ${correctDate} (${user.timezone})`);
            
            const { error } = await supabase.from('time_logs')
                .update({ date: correctDate })
                .eq('id', log.id);
            
            if (!error) {
                updatedCount++;
            } else {
                console.log(`  Update Failed: ${error.message}`);
            }
        }
    }

    console.log(`\nRe-keying complete. Updated ${updatedCount} logs.`);
}

run();

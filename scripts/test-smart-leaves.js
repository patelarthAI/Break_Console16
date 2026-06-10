const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL.trim(), env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim());

// Helper for local date string
function dateStr(d, timezone = 'America/Chicago') {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function rowToLog(row) {
    return {
        id: row.id, userId: row.user_id, eventType: row.event_type,
        timestamp: row.timestamp, date: row.date,
        addedBy: row.added_by
    };
}

async function test() {
    console.log("=== SIMULATING GETSMARTLEAVES ===");
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'];
    
    const { data: usersData } = await supabase.from('users').select('*').ilike('name', '%Meenu Singh%');
    const users = usersData;
    
    const prevDateObj = new Date(dates[0]);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateKey = dateStr(prevDateObj);
    
    console.log(`Fetching logs from ${prevDateKey} to ${dates[dates.length-1]}`);
    const { data: logsData } = await supabase
        .from('time_logs')
        .select('*')
        .in('user_id', users.map(u => u.id))
        .gte('date', prevDateKey)
        .lte('date', dates[dates.length-1]);
    
    const allLogsList = (logsData ?? []).map(rowToLog);
    console.log(`Total logs fetched: ${allLogsList.length}`);

    for (const date of dates) {
        console.log(`\n--- Date: ${date} ---`);
        for (const user of users) {
             console.log(`Checking user: ${user.name} (ID: ${user.id})`);
             
             // The logic from store.ts:
             const logsForDay = allLogsList.filter(r => r.userId === user.id && r.date === date);
             console.log(`  > logsForDay.length: ${logsForDay.length}`);
             
             if (logsForDay.length > 0) {
                 console.log(`  > Logs:`, logsForDay.map(l => `${l.eventType} at ${new Date(l.timestamp).toISOString()}`));
             } else {
                 console.log(`  > NO LOGS FOUND FOR THIS USER ON THIS DAY.`);
             }
        }
    }
    console.log("\n=== END SIMULATION ===");
}

test();

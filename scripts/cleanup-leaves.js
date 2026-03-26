const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking for incorrect System Absent/Half-Day records...");
    
    // 1. Get all System leaves
    const { data: leaves } = await supabase.from('leaves').select('*').ilike('leave_type', 'System%');
    if (!leaves || leaves.length === 0) {
        console.log("No System leaves found.");
        return;
    }

    // 2. Get all users
    const { data: users } = await supabase.from('users').select('*');
    const userMap = Object.fromEntries(users.map(u => [u.name + '||' + u.client_name, u]));

    let wrongCount = 0;
    for (const leave of leaves) {
        const user = userMap[leave.employee_name + '||' + leave.client_name];
        if (!user) continue;

        // Check if there are ANY logs for this user that fall on this DATE in THEIR timezone
        // but might have been stored with a different 'date' key.
        // Or if there is a log with the SAME date key (which would mean the System Absent is definitely wrong).
        
        const { data: logs } = await supabase.from('time_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', leave.date);

        if (logs && logs.length > 0) {
            console.log(`FOUND WRONG RECORD: ${leave.employee_name} has 'System Absent' on ${leave.date} but actually has ${logs.length} logs for that date.`);
            
            // Delete it
            const { error } = await supabase.from('leaves').delete().eq('id', leave.id);
            if (!error) {
                console.log(`  DELETED: Record ID ${leave.id}`);
                wrongCount++;
            } else {
                console.log(`  FAILED TO DELETE: ${error.message}`);
            }
        }
    }

    console.log(`\nCleanup complete. Removed ${wrongCount} incorrect records.`);
}

run();

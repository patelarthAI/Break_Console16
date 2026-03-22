const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("=== STARTING AGGRESSIVE CLEANUP ===");
    
    // Fetch EVERYTHING from leaves that looks system-generated
    const { data: leaves } = await supabase.from('leaves').select('*');
    if (!leaves) return;

    let deleted = 0;
    for (const l of leaves) {
        const isSystemType = l.leave_type && (l.leave_type.includes('System') || l.leave_type.includes('Absent'));
        const isSystemApprover = l.approver === 'System Gen' || l.approver === 'System';
        
        if (isSystemType || isSystemApprover) {
            // Re-check logs for this specific record to see if it was a mistake
            const { data: users } = await supabase.from('users').select('*').ilike('name', l.employee_name);
            const user = users?.find(u => u.client_name === l.client_name);
            
            if (user) {
                const { count } = await supabase.from('time_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('date', l.date);

                if (count > 0) {
                    console.log(`DELETING INVALID REAL RECORD: ${l.employee_name} on ${l.date} - Type: ${l.leave_type} - Logs exist: ${count}`);
                    await supabase.from('leaves').delete().eq('id', l.id);
                    deleted++;
                } else if (l.leave_type === 'System Absent' || l.leave_type === 'System Half-Day') {
                    // Even if logs don't exist, we prefer VIRTUAL leaves over physical ones for "System" types
                    // so we cleanup physical ones to prevent double-entries or static "ghost" records.
                    console.log(`DELETING PHYSICAL SYSTEM RECORD (Preferring Virtual): ${l.employee_name} on ${l.date}`);
                    await supabase.from('leaves').delete().eq('id', l.id);
                    deleted++;
                }
            }
        }
    }

    console.log(`\nCleanup complete. Removed ${deleted} physical records.`);
    console.log("=== DONE ===");
}

runAudit();

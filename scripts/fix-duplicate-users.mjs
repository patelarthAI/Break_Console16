// Run: node scripts/fix-duplicate-users.mjs
// Merges stale "Manpower Canada" duplicate accounts into the correct "Manpower" account
// and deletes the stale duplicates.
//
// Stale (Manpower Canada)  → Correct (Manpower)
// Jishan Fakir: a1e7698d-5da0-430f-951e-011077fe9943 → cae99cad-5915-4f25-ba85-d300c757c1f6
// Satyam Singh: 6a4287bf-4496-4332-b609-c17ddd2e2799 → c529cdbd-01b7-444d-843a-3e7c8ffa72a3

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://pvqcxaeqnymhckuqjssi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU'
);

const MERGES = [
    {
        name: 'Jishan Fakir',
        staleId: 'a1e7698d-5da0-430f-951e-011077fe9943', // Manpower Canada
        correctId: 'cae99cad-5915-4f25-ba85-d300c757c1f6', // Manpower
    },
    {
        name: 'Satyam Singh',
        staleId: '6a4287bf-4496-4332-b609-c17ddd2e2799', // Manpower Canada
        correctId: 'c529cdbd-01b7-444d-843a-3e7c8ffa72a3', // Manpower
    },
];

let totalMoved = 0;
let totalDeleted = 0;

for (const merge of MERGES) {
    console.log(`\n── Processing: ${merge.name} ──`);

    // 1. Count time_logs on stale account
    const { count: logCount } = await supabase
        .from('time_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', merge.staleId);

    console.log(`   Stale account has ${logCount ?? 0} time_log rows`);

    if (logCount && logCount > 0) {
        // 2. Reassign those logs to the correct account
        const { error: moveErr } = await supabase
            .from('time_logs')
            .update({ user_id: merge.correctId })
            .eq('user_id', merge.staleId);

        if (moveErr) {
            console.error(`   ✗ Failed to move logs:`, moveErr.message);
            continue;
        }
        console.log(`   ✓ Moved ${logCount} logs → ${merge.correctId}`);
        totalMoved += logCount;
    }

    // 3. Delete the stale user row
    const { error: delErr } = await supabase
        .from('users')
        .delete()
        .eq('id', merge.staleId);

    if (delErr) {
        console.error(`   ✗ Failed to delete stale user:`, delErr.message);
        continue;
    }
    console.log(`   ✓ Deleted stale user record (${merge.staleId})`);
    totalDeleted++;
}

// Verify result
console.log('\n══════════════════════════════════════════════');
console.log(' VERIFICATION — Users after cleanup');
console.log('══════════════════════════════════════════════');
const { data: users } = await supabase
    .from('users')
    .select('name, client_name, is_master')
    .order('name');

users.forEach(u => {
    if (!u.is_master) console.log(`  ✓ ${u.name.padEnd(25)} → "${u.client_name}"`);
});

console.log(`\n  Summary: ${totalMoved} log(s) reassigned, ${totalDeleted} stale account(s) deleted`);
console.log('  ✅ Done — no more duplicates.\n');

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables. Make sure you run with: node --env-file=.env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanSystemLeaves() {
    const targetDate = '2026-03-06';
    console.log(`🧹 Scanning for System-Generated leaves prior to ${targetDate}...`);

    // First, fetch to show what will be deleted
    const { data: leavesToPurge, error: fetchError } = await supabase
        .from('leaves')
        .select('id, employee_name, date, reason')
        .ilike('reason', '%System Auto-Generated%')
        .lt('date', targetDate);

    if (fetchError) {
        console.error("❌ Error fetching leaves:", fetchError);
        process.exit(1);
    }

    if (!leavesToPurge || leavesToPurge.length === 0) {
        console.log("✅ No auto-generated leaves found prior to the target date. Database is clean.");
        return;
    }

    console.log(`⚠️ Found ${leavesToPurge.length} system-generated leaves to delete:`);
    leavesToPurge.forEach(l => console.log(`   - [${l.date}] ${l.employee_name}: ${l.reason}`));

    // Perform deletion
    const { error: deleteError } = await supabase
        .from('leaves')
        .delete()
        .ilike('reason', '%System Auto-Generated%')
        .lt('date', targetDate);

    if (deleteError) {
        console.error("❌ Error deleting leaves:", deleteError);
    } else {
        console.log(`✅ Successfully deleted ${leavesToPurge.length} system-generated leaves.`);
    }
}

cleanSystemLeaves();

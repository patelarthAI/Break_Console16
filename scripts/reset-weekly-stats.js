import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables. Use node --env-file=.env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetWeeklyStats() {
    const TODAY = '2026-03-09';
    console.log(`🧹 Purging time logs before ${TODAY} for a fresh weekly start...`);

    // Fetch count to show what will be deleted
    const { count, error: fetchError } = await supabase
        .from('time_logs')
        .select('*', { count: 'exact', head: true })
        .lt('date', TODAY);

    if (fetchError) {
        console.error("❌ Error counting logs:", fetchError);
        process.exit(1);
    }

    if (!count || count === 0) {
        console.log("✅ No old logs found. Hall of Fame is already fresh.");
        return;
    }

    console.log(`⚠️ Found ${count} historical logs to purge.`);

    // Perform deletion
    const { error: deleteError } = await supabase
        .from('time_logs')
        .delete()
        .lt('date', TODAY);

    if (deleteError) {
        console.error("❌ Error deleting logs:", deleteError);
    } else {
        console.log(`✅ Successfully purged ${count} logs. The race starts TODAY! 🏆`);
    }
}

resetWeeklyStats();

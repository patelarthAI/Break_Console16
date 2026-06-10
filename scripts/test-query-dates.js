import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_URL_HERE';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_KEY_HERE';

async function main() {
    // We will extract credentials from .env.local via run_command with env vars
    // Alternatively, just require dotenv
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.local' });
    
    const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const dates = ['2026-03-19', '2026-03-20'];
    const { data: logs, error } = await sb
        .from('time_logs')
        .select('date, user_id, action')
        .in('date', dates);
        
    console.log("Error:", error);
    console.log(`Found ${logs?.length || 0} logs for 19th and 20th.`);
    if (logs && logs.length > 0) {
        console.log("Sample:", logs.slice(0, 3));
    }
}
main();

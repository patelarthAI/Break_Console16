const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicate() {
    console.log("Checking for duplicate leave records...");
    const { data: leaves } = await supabase.from('leaves').select('*');
    if (!leaves) return;

    const seen = new Set();
    let duplicates = 0;

    for (const leave of leaves) {
        // Unique key for a leave: employee + client + date + type
        // Including day_count and reason might be too specific, but let's keep it safe.
        const key = `${leave.employee_name}||${leave.client_name}||${leave.date}||${leave.leave_type}`;
        
        if (seen.has(key)) {
            console.log(`Found duplicate: ${key} (ID: ${leave.id})`);
            const { error } = await supabase.from('leaves').delete().eq('id', leave.id);
            if (!error) duplicates++;
        } else {
            seen.add(key);
        }
    }

    console.log(`Deduplication complete. Removed ${duplicates} records.`);
}

deduplicate();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Robust parsing for .env.local
function getEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
    const content = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
    return env;
}

async function main() {
    const env = getEnv();
    const sb = createClient(
        env['NEXT_PUBLIC_SUPABASE_URL'],
        env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    );

    console.log('Searching for "System Auto-Generated" leaves to purge...');
    
    // We want to delete leaves where reason contains "System Auto-Generated"
    // This removes the accidental ones created during the historical scan bug.
    const { data: leaves, error: selectErr } = await sb
        .from('leaves')
        .select('id, employee_name, date, reason')
        .ilike('reason', '%System Auto-Generated%');

    if (selectErr) {
        console.error('Select error:', selectErr);
        return;
    }

    if (!leaves || leaves.length === 0) {
        console.log('No matching leaves found. Database is already clean.');
        return;
    }

    console.log(`Found ${leaves.length} records. Purging...`);
    
    // Show a few to be sure
    leaves.slice(0, 3).forEach(l => console.log(` - ${l.employee_name} on ${l.date}: ${l.reason}`));

    const { error: deleteErr } = await sb
        .from('leaves')
        .delete()
        .in('id', leaves.map(l => l.id));

    if (deleteErr) {
        console.error('Delete error:', deleteErr);
    } else {
        console.log('Successfully purged all fake system leaves! 🧹');
    }
}

main().catch(err => console.error('Crash:', err));

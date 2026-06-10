const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: users } = await supabase.from('users').select('*').ilike('name', 'Abhik Sheth');
    console.log('User:', JSON.stringify(users, null, 2));
    if (users && users.length > 0) {
        const { data: logs } = await supabase.from('time_logs').select('*').eq('user_id', users[0].id).order('timestamp', { ascending: false }).limit(20);
        console.log('Logs:', JSON.stringify(logs, null, 2));
    }
}
check();

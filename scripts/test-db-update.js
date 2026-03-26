const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace('\r', '').replace(/(^"|"$)/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(sbUrl, sbKey);

async function test() {
    const { data: users } = await supabase.from('users').select('id, name').limit(1);
    if (!users || users.length === 0) {
        console.log("No users found"); return;
    }
    const user = users[0];
    console.log("Testing update on:", user.name);
    
    const { error } = await supabase.from('users').update({ work_mode: 'WFO' }).eq('id', user.id);
    console.log("Error details:", error);
}
test();

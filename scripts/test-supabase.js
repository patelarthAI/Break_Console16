require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        console.error('Missing env variables');
        return;
    }

    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('clients').select('*');
    
    if (error) {
        console.error('Error fetching clients:', error);
    } else {
        console.log('Successfully fetched clients:', data.length);
        console.log('Client list:', data.map(c => c.name));
    }
}

test();

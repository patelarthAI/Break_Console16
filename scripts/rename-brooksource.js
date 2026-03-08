const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvqcxaeqnymhckuqjssi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function renameBrooksource() {
    console.log('Renaming BrookSource to Brooksource...');

    // 1. Update Clients
    const { data: clients, error: cError } = await supabase
        .from('clients')
        .update({ name: 'Brooksource' })
        .eq('name', 'BrookSource')
        .select();
    
    if (cError) console.error('Error updating clients:', cError);
    else console.log(`Updated ${clients?.length || 0} client records`);

    // 2. Update Users
    const { data: users, error: uError } = await supabase
        .from('users')
        .update({ client_name: 'Brooksource' })
        .eq('client_name', 'BrookSource')
        .select();

    if (uError) console.error('Error updating users:', uError);
    else console.log(`Updated ${users?.length || 0} user records`);

    // 3. Update Leaves
    const { data: leaves, error: lError } = await supabase
        .from('leaves')
        .update({ client_name: 'Brooksource' })
        .eq('client_name', 'BrookSource')
        .select();

    if (lError) console.error('Error updating leaves:', lError);
    else console.log(`Updated ${leaves?.length || 0} leave records`);

    console.log('Cleanup complete');
}

renameBrooksource();

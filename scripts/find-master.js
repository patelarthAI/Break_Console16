const { createClient } = require('@supabase/supabase-js');
const url = 'https://pvqcxaeqnymhckuqjssi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU';

const supabase = createClient(url, key);

async function findMaster() {
    const { data, error } = await supabase
        .from('users')
        .select('name, client_name')
        .eq('is_master', true)
        .limit(5);
    
    if (error) {
        console.error('Error fetching master users:', error);
        return;
    }
    
    console.log('Master Users:');
    console.log(JSON.stringify(data, null, 2));
}

findMaster();

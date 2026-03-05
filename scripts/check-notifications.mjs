import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://pvqcxaeqnymhckuqjssi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU'
);

async function check() {
    const { data, error } = await supabase.from('notifications').select('id').limit(1);
    if (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
    console.log('Notifications table exists!');
}

check();

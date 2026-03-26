const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pvqcxaeqnymhckuqjssi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicateLeaves() {
    console.log('Fetching all leaves...');
    const { data: leaves, error } = await supabase
        .from('leaves')
        .select('*');

    if (error) {
        console.error('Error fetching leaves:', error);
        return;
    }

    console.log(`Analyzing ${leaves.length} records...`);

    const groups = {}; // Key: "employee_name|date"
    const duplicates = [];

    leaves.forEach(l => {
        const key = `${l.employee_name.toLowerCase().trim()}|${l.date}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(l);
    });

    for (const key in groups) {
        if (groups[key].length > 1) {
            // Found duplicate
            // We keep the one that is NOT smart (real) if available, or just the first one.
            const sorted = groups[key].sort((a, b) => {
                const aSmart = (a.is_smart || false) ? 1 : 0;
                const bSmart = (b.is_smart || false) ? 1 : 0;
                return aSmart - bSmart; // Real leaves (0) first
            });

            // Keep index 0, delete others
            for (let i = 1; i < sorted.length; i++) {
                duplicates.push(sorted[i].id);
            }
        }
    }

    if (duplicates.length === 0) {
        console.log('No duplicate records found.');
        return;
    }

    console.log(`Found ${duplicates.length} duplicate records. Deleting...`);

    // Delete in batches of 50
    for (let i = 0; i < duplicates.length; i += 50) {
        const batch = duplicates.slice(i, i + 50);
        const { error: dError } = await supabase
            .from('leaves')
            .delete()
            .in('id', batch);
        
        if (dError) {
            console.error('Error deleting batch:', dError);
        } else {
            console.log(`Deleted ${batch.length} records...`);
        }
    }

    console.log('Deduplication complete.');
}

deduplicateLeaves();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pvqcxaeqnymhckuqjssi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU";

const supabase = createClient(supabaseUrl, supabaseKey);

const missingDataRows = `
27-Oct-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
28-Oct-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
29-Oct-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
30-Oct-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
31-Oct-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
01-Nov-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
02-Nov-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
03-Nov-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
04-Nov-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
05-Nov-25	BrookSource	Hardik Harsola	No	Sick	Not Approved	LWP(Doc not Received)	1
06-Feb-26	BrookSource	Hardik Harsola	No	Sick	Arth Patel	HD-Sick	0.5
`.trim();

async function run() {
    const lines = missingDataRows.split('\n');
    console.log(`Processing ${lines.length} lines`);

    const clientSet = new Set<string>();
    const userMap = new Map<string, string>();
    const inserts = [];

    const monthMap: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length < 8) continue;

        let [dateStrRaw, client, name, plannedRaw, reason, approver, type, countRaw] = cols;
        client = client.trim();
        name = name.trim();

        if (client.toLowerCase() === 'brooksource') client = 'Brooksource';

        clientSet.add(client);
        userMap.set(name, client);

        const parts = dateStrRaw.trim().split('-'); // e.g. 29-Jan-24
        if (parts.length < 3) continue;
        const day = parts[0].padStart(2, '0');
        const month = monthMap[parts[1]] || '01';
        let year = parts[2];
        if (year.length === 2) year = '20' + year;

        const dateStr = `${year}-${month}-${day}`;

        let isPlanned = true;
        if (plannedRaw.toLowerCase().trim() === 'no') isPlanned = false;

        let dayCount = parseFloat(countRaw.trim());
        if (isNaN(dayCount)) dayCount = 1;

        inserts.push({
            client_name: client,
            employee_name: name,
            leave_type: type.trim(),
            is_planned: isPlanned,
            reason: reason.trim(),
            approver: approver.trim(),
            day_count: dayCount,
            date: dateStr,
        });
    }

    // Ensure users and clients
    for (const c of clientSet) {
        await supabase.from('clients').insert([{ name: c }]).select();
    }
    for (const [uName, uClient] of userMap.entries()) {
        await supabase.from('users').insert([{ name: uName, client_name: uClient, is_approved: true }]);
    }

    let successCount = 0;
    // We do upsert or insert to be safe if a row was half-present
    for (const row of inserts) {
        // Checking if exactly matching row exists first
        const { data: existing } = await supabase
            .from('leaves')
            .select('id')
            .eq('employee_name', row.employee_name)
            .eq('date', row.date)
            .eq('leave_type', row.leave_type)
            .eq('reason', row.reason);

        if (existing && existing.length > 0) {
            // Already there
            successCount++;
            continue;
        }

        const { error } = await supabase.from('leaves').insert([row]);
        if (error) {
            console.error(`Failed to insert for ${row.employee_name} on ${row.date}`, error.message);
        } else {
            successCount++;
        }
    }
    console.log(`Successfully processed ${successCount} / ${inserts.length} leaves from the new batch.`);
}

run().catch(console.error);

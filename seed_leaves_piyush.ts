import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pvqcxaeqnymhckuqjssi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU";

const supabase = createClient(supabaseUrl, supabaseKey);

const newMissingData = `
15-Jan-24	HPP Staffing	Piyush Luhar	No	Sick Leave	Not Approved	LWP	1
17-Jun-24	HPP Staffing	Piyush Luhar	No	Sick Leave	Not Approved	LWP	1
08-Jul-24	HPP Staffing	Piyush Luhar	No	Health Issue	Not Approved	LWP	1
14-Jan-25	HPP Staffing	Piyush Luhar	No	Uttarayan	Not Approved	LWP	1
08-May-25	HPP Staffing	Piyush Luhar	No	Train issue	Not Approved	LWP	1
25-Aug-25	HPP Staffing	Piyush Luhar	No	Health Issue	Not Approved	LWP	1
`.trim();

async function run() {
    const lines = newMissingData.split('\n');
    console.log(`Processing ${lines.length} lines`);

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

        const parts = dateStrRaw.trim().split('-'); // e.g. 29-Jan-24
        if (parts.length < 3) continue;
        const day = parts[0].padStart(2, '0');
        const month = monthMap[parts[1]] || '01';
        let year = parts[2];
        if (year.length === 2) year = '20' + year; // Convert 24 to 2024

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

    let successCount = 0;
    for (const row of inserts) {
        const { error } = await supabase.from('leaves').insert([row]);
        if (error) {
            console.error(`Failed to insert for ${row.employee_name} on ${row.date}`, error.message);
        } else {
            console.log(`Inserted ${row.employee_name} on ${row.date}`);
            successCount++;
        }
    }
    console.log(`Successfully inserted ${successCount} / ${inserts.length} leaves.`);
}

run().catch(console.error);

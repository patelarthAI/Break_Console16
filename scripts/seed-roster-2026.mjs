import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(
    envFile.split('\n')
        .filter(l => l.includes('='))
        .map(l => {
            const parts = l.split('=');
            return [parts[0].trim(), parts.slice(1).join('=').trim()];
        })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const RECRUITERS = [
    "Shubham Shrivas", "Akash Singh", "Amlan Roy", "Ankit Kosta", "Faizan Mirza",
    "Jash Dave", "Kinjal Bava", "Megha Dhoke", "Neeraj Pandey", "Peeyush Gupta",
    "Rajeev Ranjan", "Ramiz Karagathara", "Rekha Malkani", "Sachin Patle",
    "Shivam baghel", "Shrikant Pardeshi", "Samir Shaikh", "Mihir Solanki",
    "Meenu Singh", "Adnan Sayed", "Abhishek Sahu", "Abhishekh Pandey",
    "Ankita Gupta", "Ankita Khawase", "Anurag Gupta", "Bhavna Sharma",
    "Gaurav Singh", "Harshita Gupta", "Indrayani Deshpande", "Ishita Chouhan",
    "Monis Farooqui", "Muskan Soni", "Nilisha Bhurade", "Pallavi Gupta",
    "Pratiksha Barange", "Sawan Chouhan"
];

async function seed() {
    console.log('🚀 Seeding 2026 Roster...');

    // 1. Clear existing non-master users (optional, but requested "change all names to current")
    // For safety, we'll just insert/update.
    
    for (const name of RECRUITERS) {
        const { data: existing } = await supabase.from('users').select('id').eq('name', name).maybeSingle();
        
        if (existing) {
            console.log(`- Updating ${name}`);
            await supabase.from('users').update({
                is_approved: true,
                is_master: false,
                client_name: 'Brooksource',
                work_mode: 'WFO',
                timezone: 'Asia/Kolkata',
                shift_start: '10:00',
                shift_end: '19:00'
            }).eq('id', existing.id);
        } else {
            console.log(`+ Inserting ${name}`);
            await supabase.from('users').insert({
                name,
                is_approved: true,
                is_master: false,
                client_name: 'Brooksource',
                work_mode: 'WFO',
                timezone: 'Asia/Kolkata',
                shift_start: '10:00',
                shift_end: '19:00'
            });
        }
    }

    console.log('✅ Roster Seeded Successfully.');
}

seed();

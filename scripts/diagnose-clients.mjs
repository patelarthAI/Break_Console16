// Run: node scripts/diagnose-clients.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://pvqcxaeqnymhckuqjssi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU'
);

const { data: clients } = await supabase.from('clients').select('*').order('name');
const { data: users } = await supabase.from('users').select('id, name, client_name, is_master').order('name');
const { data: leaves } = await supabase.from('leaves').select('id, employee_name, client_name').order('employee_name');

console.log('\n══════════════════════════════════════════════');
console.log(' CANONICAL CLIENTS IN SETTINGS');
console.log('══════════════════════════════════════════════');
clients.forEach(c => console.log(`  ✓ "${c.name}"`));

const canonicalNames = new Set(clients.map(c => c.name));

console.log('\n══════════════════════════════════════════════');
console.log(' ALL USERS — current client_name');
console.log('══════════════════════════════════════════════');
let userIssues = 0;
users.forEach(u => {
    const ok = canonicalNames.has(u.client_name) || u.is_master;
    const flag = ok ? '✓' : '✗';
    console.log(`  ${flag} ${u.name.padEnd(25)} → "${u.client_name}"${u.is_master ? ' [MASTER]' : ''}${!ok ? ' ← MISMATCH' : ''}`);
    if (!ok && !u.is_master) userIssues++;
});
console.log(`\n  ${userIssues} user(s) with mismatched client names`);

// Check leaves table for client mismatches
const { data: leafClients } = await supabase.from('leaves').select('client_name').order('client_name');
const uniqueLeafClients = [...new Set(leafClients.map(l => l.client_name))];

console.log('\n══════════════════════════════════════════════');
console.log(' UNIQUE CLIENT NAMES USED IN leaves TABLE');
console.log('══════════════════════════════════════════════');
uniqueLeafClients.forEach(n => {
    const ok = canonicalNames.has(n);
    console.log(`  ${ok ? '✓' : '✗'} "${n}"${!ok ? ' ← MISMATCH' : ''}`);
});

// Recruiter detail: find people in leaves with non-canonical or duplicate entries
console.log('\n══════════════════════════════════════════════');
console.log(' LEAVES ROWS WITH MISMATCHED CLIENT NAMES');
console.log('══════════════════════════════════════════════');
let leaveIssues = 0;
leaves.forEach(l => {
    if (!canonicalNames.has(l.client_name)) {
        console.log(`  ✗ "${l.employee_name}" → "${l.client_name}" (id: ${l.id})`);
        leaveIssues++;
    }
});
if (leaveIssues === 0) console.log('  All leave records use canonical client names.');
console.log(`\n  ${leaveIssues} leave row(s) with mismatched client names`);

// Find duplicate people (same name, different client)
console.log('\n══════════════════════════════════════════════');
console.log(' DUPLICATE PEOPLE (same name, different client)');
console.log('══════════════════════════════════════════════');
const nameCounts = {};
users.filter(u => !u.is_master).forEach(u => {
    if (!nameCounts[u.name]) nameCounts[u.name] = [];
    nameCounts[u.name].push({ id: u.id, client: u.client_name });
});
let dupCount = 0;
Object.entries(nameCounts).forEach(([name, entries]) => {
    if (entries.length > 1) {
        console.log(`  ⚠ "${name}" appears ${entries.length} times:`);
        entries.forEach(e => console.log(`      id=${e.id} client="${e.client}"`));
        dupCount++;
    }
});
if (dupCount === 0) console.log('  No duplicate names found.');
console.log('');


const { toZonedTimestamp, toZonedMinutes } = require('./src/lib/timeUtils');

function test() {
    const date = '2024-03-24';
    const time = '17:00';
    const tz = 'America/Chicago';
    
    const ts = toZonedTimestamp(date, time, tz);
    const dateObj = new Date(ts);
    
    console.log('UTC String:', dateObj.toUTCString());
    console.log('Local Min (CST expected 1020):', toZonedMinutes(ts, tz));
    
    const penaltyTs = ts - (10 * 60000);
    console.log('Penalty UTC String:', new Date(penaltyTs).toUTCString());
    console.log('Penalty Local Min (CST expected 1010):', toZonedMinutes(penaltyTs, tz));
}

test();

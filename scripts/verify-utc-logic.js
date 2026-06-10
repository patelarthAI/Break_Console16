function toZonedMinutes(ts, timezone = 'America/Chicago') {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(ts));
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return (h === 24 ? 0 : h) * 60 + m;
}

function getZonedShiftMins(utcHHMM, dateStr, timezone) {
    const [h, m] = utcHHMM.split(':').map(Number);
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(yr, mo - 1, dy, h, m));
    return toZonedMinutes(utcDate.getTime(), timezone);
}

function test() {
    const chicagoTz = 'America/Chicago';
    const indiaTz = 'Asia/Kolkata';
    const date = '2026-03-14';
    
    console.log('--- UTC Shift Conversion Verification ---');
    
    // 03:00 UTC to Chicago (Central Time)
    // -6h (Standard) or -5h (Daylight)?
    // March 14, 2026 is Central Daylight Time (CDT begins March 8, 2026)
    // 03:00 UTC - 5h = 22:00 (Previous Day - March 13)
    const chicagoStart = getZonedShiftMins('03:00', date, chicagoTz);
    console.log(`03:00 UTC in Chicago (on 2026-03-14) -> ${Math.floor(chicagoStart/60)}:${(chicagoStart%60).toString().padStart(2,'0')} local mins (${chicagoStart})`);
    
    // 01:00 UTC to Chicago
    // 01:00 UTC - 5h = 20:00 (Previous Day)
    const chicagoEarly = getZonedShiftMins('01:00', date, chicagoTz);
     console.log(`01:00 UTC in Chicago -> ${Math.floor(chicagoEarly/60)}:${(chicagoEarly%60).toString().padStart(2,'0')} local`);

    // 09:00 UTC to India (+5:30)
    // 09:00 + 5:30 = 14:30
    const indiaStart = getZonedShiftMins('09:00', date, indiaTz);
    console.log(`09:00 UTC in India -> ${Math.floor(indiaStart/60)}:${(indiaStart%60).toString().padStart(2,'0')} local`);
}

test();

const { getZonedShiftMins, getRelativeDate, toZonedMinutes } = require('../src/lib/timeUtils');

function test() {
    console.log('--- UTC to Local Shift Conversion Test ---');
    
    // Test Case 1: Meenu Singh (Chicago) - Shift 03:00 UTC (Night Shift in Local)
    // 03:00 UTC = 22:00 (Previous Day) or 21:00 (Previous Day) depending on DST
    const chicagoTz = 'America/Chicago';
    const date = '2026-03-14';
    const utcStart = '03:00';
    
    const localMins = getZonedShiftMins(utcStart, date, chicagoTz);
    const h = Math.floor(localMins / 60);
    const m = localMins % 60;
    console.log(`UTC ${utcStart} in ${chicagoTz} on ${date} is ${h}:${m.toString().padStart(2, '0')} local minutes (${localMins})`);

    // Test Case 2: India Standard Time (IST) - Shift 09:00 UTC
    // 09:00 UTC = 14:30 IST (+5:30)
    const istTz = 'Asia/Kolkata';
    const localMinsIST = getZonedShiftMins('09:00', date, istTz);
    console.log(`UTC 09:00 in ${istTz} is ${Math.floor(localMinsIST / 60)}:${(localMinsIST % 60).toString().padStart(2, '0')} local`);

    console.log('\n--- Gross Duration HD Rule Logic Test (Simulation) ---');
    
    function simulateHD(punchIn, punchOut, now) {
        const grossMs = (punchOut || now) - punchIn;
        const isHD = grossMs > 0 && grossMs < 4 * 3600000;
        return { grossMs, isHD, grossMins: Math.round(grossMs / 60000) };
    }

    const t1 = Date.now();
    const t2 = t1 + (4.5 * 3600000); // 4.5 hours later
    const case1 = simulateHD(t1, t2);
    console.log(`Case 1 (4.5h gross): ${case1.grossMins}m, Is HD? ${case1.isHD}`);

    const t3 = t1 + (3.5 * 3600000); // 3.5 hours later
    const case2 = simulateHD(t1, t3);
    console.log(`Case 2 (3.5h gross): ${case2.grossMins}m, Is HD? ${case2.isHD}`);
}

test();

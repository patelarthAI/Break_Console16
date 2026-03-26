'use client';
import { useState, useEffect, useRef } from 'react';

export function useClock() {
    const [time, setTime] = useState<Date>(new Date());
    const rafRef = useRef<number>(0);

    useEffect(() => {
        let last = 0;
        const tick = (ts: number) => {
            if (ts - last >= 1000) {
                last = ts;
                setTime(new Date());
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return time;
}

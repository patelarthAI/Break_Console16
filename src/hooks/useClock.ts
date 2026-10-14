'use client';
import { useState, useEffect, useRef } from 'react';

export function useClock() {
    const [time, setTime] = useState<Date | null>(null);

    useEffect(() => {
        setTime(new Date());

        const intervalId = setInterval(() => {
            setTime(new Date());
        }, 1000);

        const handleSync = () => {
            if (!document.hidden) {
                setTime(new Date());
            }
        };

        document.addEventListener('visibilitychange', handleSync);
        window.addEventListener('focus', handleSync);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleSync);
            window.removeEventListener('focus', handleSync);
        };
    }, []);

    return time;
}

'use client';
import { useClock } from '@/hooks/useClock';

export default function Clock() {
    const now = useClock();

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const h12 = (now.getHours() % 12 || 12).toString().padStart(2, '0');

    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="flex flex-col items-center justify-center py-6 select-none">
            <div className="flex items-center gap-1.5 backdrop-blur-md bg-black/20 px-8 py-5 rounded-3xl border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="clock-digit flex tracking-tighter">{h12[0]}<span className="w-[0.55em] text-center">{h12[1]}</span></div>
                <span className="clock-colon mx-1 pb-2">:</span>
                <div className="clock-digit flex tracking-tighter">{minutes[0]}<span className="w-[0.55em] text-center">{minutes[1]}</span></div>
                <div className="flex flex-col ml-3 gap-0.5 justify-center mt-1 text-left">
                    <span className="text-xl font-bold text-electric tracking-widest">{ampm}</span>
                    <div className="flex items-center gap-0.5 mt-0.5 opacity-80">
                        <span className="clock-digit tracking-tighter text-[1rem] leading-none" style={{ textShadow: 'none' }}>{seconds[0]}</span>
                        <span className="clock-digit tracking-tighter text-[1rem] leading-none" style={{ textShadow: 'none' }}>{seconds[1]}</span>
                    </div>
                </div>
            </div>
            <p className="text-slate-400 font-medium tracking-widest text-xs uppercase mt-5">
                {dateStr}
            </p>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

const MOTIVATIONAL_QUOTES = [
  { text: "Presence is power. When you're at the desk, opportunities find you.", author: "Elite Standard" },
  { text: "The best recruiters aren't just talented — they're always there for their candidates.", author: "Recruitment Creed" },
  { text: "Success is 90% showing up and staying checked in.", author: "Brigade Mindset" },
  { text: "Every minute away from the desk is a missed connection. Stay active, stay winning.", author: "Focus Protocol" },
  { text: "Consistency at the desk builds trust with clients and candidates alike.", author: "Pulse System" },
  { text: "Availability is the ultimate ability. Be present, be legend.", author: "The Brigade Way" },
  { text: "Focus is a muscle. Train it by staying present and dialed in.", author: "Brigade Command" },
  { text: "A filled roster starts with an active recruiter. Win the day from your desk.", author: "Aura Protocol" }
];

function todayIndex() {
  const n = new Date(), s = new Date(n.getFullYear(), 0, 0);
  return Math.floor((n.getTime() - s.getTime()) / 86400000) % MOTIVATIONAL_QUOTES.length;
}

export default function QuotesCard() {
  const [idx, setIdx] = useState(todayIndex());
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
        setFading(false);
      }, 200);
    }, 10000); // cycle every 10s
    return () => clearInterval(timer);
  }, []);

  const next = () => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
      setFading(false);
    }, 200);
  };

  const q = MOTIVATIONAL_QUOTES[idx];

  return (
    <div className="card p-5 border-[#6366f1]/20 bg-gradient-to-b from-[#6366f1]/[0.05] to-transparent shadow-[0_12px_40px_rgba(99,102,241,0.05)] backdrop-blur-md relative overflow-hidden group">
      {/* Glowing Top line */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-[#6366f1]/60 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/25 text-[#6366f1]">
            <Sparkles size={14} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#818cf8] block">Daily Spark</span>
        </div>
        <button 
          onClick={next} 
          className="p-1 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/10 text-slate-500 hover:text-white transition-all cursor-pointer"
        >
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Quote Container with internal fade */}
      <div 
        className="relative z-10 flex flex-col gap-3 transition-all duration-300"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? 'translateY(4px)' : 'none',
        }}
      >
        <span className="text-3xl font-black text-[#6366f1] opacity-25 leading-none font-serif select-none mt-1 h-3 block">“</span>
        <p className="text-[11.5px] leading-relaxed text-slate-300 font-medium italic font-sans pl-1">
          {q.text}
        </p>
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04] mt-1 pl-1">
          <div className="w-4 h-[1.5px] bg-[#6366f1] opacity-50 rounded" />
          <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-widest">
            {q.author}
          </span>
        </div>
      </div>
    </div>
  );
}

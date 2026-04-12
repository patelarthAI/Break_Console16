'use client';

import { motion } from 'framer-motion';

interface KPITileProps {
  label: string;
  value: number | string;
  isActive?: boolean;
  accentColor?: string;
  onClick?: () => void;
}

export default function KPITile({ label, value, isActive = false, accentColor = '#3b82f6', onClick }: KPITileProps) {
  return (
    <motion.button
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-6 rounded-[2rem] transition-all duration-500 overflow-hidden w-full group ${
        isActive
          ? 'bg-[#0a001a] border-2 shadow-2xl'
          : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
      }`}
      style={isActive ? { borderColor: `${accentColor}80`, boxShadow: `0 20px 40px -15px ${accentColor}40` } : {}}
    >
      {/* Dynamic Background Aura */}
      <div 
        className={`absolute inset-0 transition-opacity duration-700 ${isActive ? 'opacity-30' : 'opacity-0 group-hover:opacity-10'}`}
        style={{ 
          background: `radial-gradient(circle at 50% 0%, ${accentColor}, transparent 80%)` 
        }}
      />
      
      {/* Inner Bevel */}
      <div className="absolute inset-0 rounded-[2rem] border border-white/[0.05] pointer-events-none" />

      <div className="relative flex flex-col items-center z-10 w-full">
        <span 
          className="text-[10px] font-black uppercase tracking-[0.25em] mb-3 transition-colors duration-500"
          style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.4)' }}
        >
          {label}
        </span>
        
        <div className="relative">
          <div
            className="text-5xl font-outfit font-black leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-110"
            style={{ 
              color: isActive ? '#fff' : accentColor,
              textShadow: isActive ? `0 0 25px ${accentColor}80` : 'none'
            }}
          >
            {value}
          </div>
          
          {/* Subtle underline glow when active */}
          {isActive && (
            <motion.div 
              layoutId={`kpi-glow-${label}`}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full blur-[2px]"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </div>
      </div>

      {/* Decorative Corner Asset */}
      <div 
        className="absolute -bottom-4 -right-4 w-16 h-16 blur-2xl opacity-20 transition-transform duration-700 group-hover:scale-150"
        style={{ background: accentColor }}
      />
    </motion.button>
  );
}

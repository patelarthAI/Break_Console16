'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface KPITileProps {
  label: string;
  value: number | string;
  isActive?: boolean;
  accentColor?: string;
  onClick?: () => void;
}

export default function KPITile({ label, value, isActive = false, accentColor = '#3b82f6', onClick }: KPITileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    const rX = -(mouseY / (height / 2)) * 10;
    const rY = (mouseX / (width / 2)) * 10;
    setRotate({ x: rX, y: rY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      className={`relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl transition-all duration-300 overflow-hidden w-[130px] lg:w-full flex-shrink-0 group ${
        isActive
          ? 'bg-gradient-to-br from-[#0c071a]/90 to-[#04020a]/95 border-2 shadow-2xl'
          : 'bg-white/[0.012] border border-white/[0.04] hover:bg-white/[0.025]'
      }`}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        borderColor: isActive 
          ? `${accentColor}cc` 
          : isHovered 
          ? `${accentColor}55` 
          : 'rgba(255, 255, 255, 0.04)',
        boxShadow: isActive 
          ? `0 20px 40px -12px ${accentColor}50, inset 0 1px 0 rgba(255,255,255,0.05)` 
          : isHovered 
          ? `0 12px 24px -8px ${accentColor}25` 
          : 'inset 0 1px 0 rgba(255,255,255,0.01)',
      }}
    >
      {/* Top Accent Glow Line */}
      <div 
        className={`absolute top-0 left-4 right-4 h-[1.5px] transition-all duration-300 pointer-events-none ${isActive ? 'opacity-100 h-[2px]' : 'opacity-25 group-hover:opacity-75'}`}
        style={{ 
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          boxShadow: isActive ? `0 1px 8px ${accentColor}` : 'none'
        }}
      />

      {/* Holographic Scanline Overlay */}
      <div className="absolute inset-0 scanline-overlay opacity-30 pointer-events-none" />

      {/* Dynamic Background Aura */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${isActive ? 'opacity-30' : 'opacity-0 group-hover:opacity-10'}`}
        style={{ 
          background: `radial-gradient(circle at 50% 0%, ${accentColor}, transparent 80%)` 
        }}
      />
      
      {/* Inner Bevel */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.03] pointer-events-none" />

      <div className="relative flex flex-col items-center z-10 w-full">
        {/* Neon dot/ring indicator in the center-top */}
        <div 
          className="w-1.5 h-1.5 rounded-full mb-1.5 transition-all duration-300"
          style={{
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
            opacity: isActive || isHovered ? 1 : 0.3,
            transform: isActive || isHovered ? 'scale(1.2)' : 'scale(1)',
          }}
        />

        <span 
          className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] mb-2 transition-colors duration-300 select-none text-center"
          style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.35)' }}
        >
          {label}
        </span>
        
        <div className="relative">
          <div
            className="text-3xl sm:text-4xl lg:text-5xl font-black leading-none tracking-tighter transition-all duration-300 font-mono"
            style={{ 
              color: isActive ? '#fff' : accentColor,
              textShadow: isActive ? `0 0 25px ${accentColor}80` : 'none',
              filter: isHovered ? `drop-shadow(0 0 6px ${accentColor}80)` : 'none',
            }}
          >
            {value}
          </div>
          
          {/* Underline glow when active */}
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
        className="absolute -bottom-6 -right-6 w-20 h-20 blur-3xl opacity-10 transition-transform duration-500 group-hover:scale-130 pointer-events-none"
        style={{ background: accentColor }}
      />
    </motion.button>
  );
}

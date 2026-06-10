'use client';

import { motion } from 'framer-motion';

interface AuraRingProps {
  color: string;
  isActive?: boolean;
  isOverdue?: boolean;
}

export default function AuraRing({ color, isActive, isOverdue }: AuraRingProps) {
  const glowOpacity = isOverdue ? 0.6 : 0.3;
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ '--aura-color': color } as any}>
      {/* Dynamic Glow Layer */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.15, 1] : 1,
          opacity: isActive ? [0.2, 0.4, 0.2] : 0.1,
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-[-15px] rounded-full blur-[20px]"
        style={{ backgroundColor: color }}
      />

      {/* SVG Procedural Rings */}
      <svg className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)]" viewBox="0 0 100 100">
        <motion.circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          strokeDasharray="4 8"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ opacity: 0.3 }}
        />
        
        {isActive && (
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="20 180"
            strokeLinecap="round"
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ opacity: 0.6 }}
          />
        )}

        {isOverdue && (
          <motion.circle
            cx="50"
            cy="50"
            r="49"
            fill="none"
            stroke="#ff3b6b"
            strokeWidth="2"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </svg>
    </div>
  );
}

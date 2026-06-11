'use client';

import { motion } from 'framer-motion';

function hashCode(str: string) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Hyper-saturated, high-contrast Cyberpunk / Gaming color palettes
const PREMIUM_COLORS = [
  { from: '#FF007F', to: '#00F0FF' }, // Cyberpunk Pink & Cyan
  { from: '#7000FF', to: '#FF00E5' }, // Electric Purple & Magenta
  { from: '#00FF87', to: '#60EFFF' }, // Toxic Green & Neon Blue
  { from: '#FF3366', to: '#FF9933' }, // Core Fire Red & Orange
  { from: '#0061FF', to: '#60EFFF' }, // Deep Blue & Laser Blue
  { from: '#FFE53B', to: '#FF2525' }, // Sunburst Yellow & Crimson
  { from: '#21D4FD', to: '#B721FF' }, // Nebula Blue & Violet
  { from: '#08AEEA', to: '#2AF598' }, // Mint & Emerald
];

const SHAPES = [
  // Apple Premium Squircle
  (fill: string, stroke: string, sw: number) => {
    const p = sw / 2;
    return (
      <rect
        x={p + 1}
        y={p + 1}
        width={98 - sw}
        height={98 - sw}
        rx="28"
        ry="28"
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    );
  }
];

const OVERLAYS = [
  // Moving Tech Grid
  <pattern key="pat-grid" id="pat-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
    <animate attributeName="x" from="0" to="20" dur="3s" repeatCount="indefinite" />
    <animate attributeName="y" from="0" to="20" dur="3s" repeatCount="indefinite" />
    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
  </pattern>,
  // Flowing Honeycomb Diagonal
  <pattern key="pat-diag" id="pat-diag" x="0" y="0" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
    <animate attributeName="x" from="0" to="10" dur="1.5s" repeatCount="indefinite" />
    <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
  </pattern>,
  // Pulsing Circuit Dots
  <pattern key="pat-dots" id="pat-dots" x="0" y="0" width="15" height="15" patternUnits="userSpaceOnUse">
    <animate attributeName="y" from="0" to="-15" dur="4s" repeatCount="indefinite" />
    <circle cx="2" cy="2" r="2.5" fill="rgba(255,255,255,0.35)" />
    <circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.45)" />
  </pattern>,
  // Scanning Crosshairs
  <pattern key="pat-cross" id="pat-cross" x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse">
    <animate attributeName="x" from="25" to="0" dur="2s" repeatCount="indefinite" />
    <animate attributeName="y" from="25" to="0" dur="2s" repeatCount="indefinite" />
    <path d="M 12.5 5 L 12.5 20 M 5 12.5 L 20 12.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
  </pattern>
];

export default function DynamicAvatar({
  name,
  user,
  size = 36,
  statusColor,
  isPulsing = false,
  className = ''
}: {
  name?: string;
  user?: { name: string };
  size?: number;
  statusColor?: string;
  isPulsing?: boolean;
  className?: string;
}) {
  const displayName = name ?? user?.name ?? 'User';
  const hash = Math.abs(hashCode(displayName));
  const colorPair = PREMIUM_COLORS[hash % PREMIUM_COLORS.length];
  const shapeIndex = hash % SHAPES.length;
  const overlayIndex = Math.abs(Math.floor(hash / 4)) % OVERLAYS.length;
  
  const initials = displayName.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  const isOffline = statusColor === '#EF4444' || statusColor === '#64748B' || !isPulsing;
  
  const gradId = `grad-${hash}`;
  const glowId = `glow-${hash}`;
  
  const activeStroke = statusColor || '#FFFFFF';
  const strokeColor = isOffline ? 'rgba(255,255,255,0.1)' : activeStroke;
  const strokeWidth = isOffline ? 2 : 3.5;
  
  const renderShape = SHAPES[shapeIndex];

  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Intense Dynamic Aura Glow */}
      {!isOffline && (
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -8,
            background: activeStroke,
            filter: 'blur(12px)',
            borderRadius: '28%',
            zIndex: 0
          }}
        />
      )}

      {/* SVG Avatar Container */}
      <svg 
        viewBox="0 0 100 100" 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative', 
          zIndex: 2,
          filter: isOffline ? 'none' : `drop-shadow(0 0 10px ${activeStroke}90)`
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {isOffline ? (
              <>
                <stop offset="0%" stopColor="rgba(40,40,45,0.8)" />
                <stop offset="100%" stopColor="rgba(20,20,25,0.8)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={colorPair.from}>
                  {/* Liquid gradient animation */}
                  <animate attributeName="stop-color" values={`${colorPair.from};${colorPair.to};${colorPair.from}`} dur="4s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor={colorPair.to}>
                  <animate attributeName="stop-color" values={`${colorPair.to};${colorPair.from};${colorPair.to}`} dur="4s" repeatCount="indefinite" />
                </stop>
              </>
            )}
          </linearGradient>

          <radialGradient id={glowId} cx="30%" cy="30%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)">
              <animate attributeName="stop-color" values="rgba(255,255,255,0.2);rgba(255,255,255,0.6);rgba(255,255,255,0.2)" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Render all overlays to defs, we will reference one */}
          {OVERLAYS}
        </defs>

        {/* 1. Base Liquid Gradient Shape */}
        {renderShape(`url(#${gradId})`, 'none', 0)}

        {/* 2. Procedural Moving Tech Overlay (only visible if active) */}
        {!isOffline && renderShape(`url(#${OVERLAYS[overlayIndex].props.id})`, 'none', 0)}

        {/* 3. Inner 3D Pulsing Glow */}
        {!isOffline && renderShape(`url(#${glowId})`, 'none', 0)}

        {/* 4. Bold Status Border */}
        {renderShape('none', strokeColor, strokeWidth)}
      </svg>

      {/* Initials Layer */}
      <div style={{
        position: 'absolute',
        zIndex: 3,
        color: isOffline ? 'rgba(255,255,255,0.3)' : '#FFFFFF', 
        fontSize: size * 0.38, 
        fontWeight: 900, 
        fontFamily: 'var(--f-display)',
        letterSpacing: '0.05em',
        textShadow: isOffline ? 'none' : '0 2px 8px rgba(0,0,0,0.9)'
      }}>
        {initials}
      </div>

      {/* Embedded Status Indicator Dot */}
      {statusColor && (
        <motion.div 
          animate={isPulsing ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', 
            bottom: -5, 
            right: -5, 
            width: Math.max(14, size * 0.35), 
            height: Math.max(14, size * 0.35),
            borderRadius: '50%', 
            backgroundColor: statusColor, 
            border: '3px solid #0A0A0C', // Extremely deep border punch-out
            boxShadow: isPulsing ? `0 0 16px ${statusColor}, inset 0 2px 4px rgba(255,255,255,0.6)` : 'inset 0 1px 2px rgba(0,0,0,0.5)',
            zIndex: 10
          }} 
        />
      )}
    </div>
  );
}

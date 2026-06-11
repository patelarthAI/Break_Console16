import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Normalizes a name to Title Case (e.g., "arth patel" -> "Arth Patel").
 * Handles multiple spaces, leading/trailing whitespace, and mixed casing.
 */
export function toTitleCase(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const AVATAR_COLORS = [
  '#0d9488', '#7c3aed', '#d97706', '#dc2626',
  '#2563eb', '#059669', '#db2777', '#9333ea',
  '#0891b2', '#65a30d', '#ea580c', '#4f46e5'
];

export function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Golden ratio conjugate (360 / 1.618... approx 222.5)
  const h = Math.abs(hash % 360);
  const s = 65 + (Math.abs(hash * 31) % 20); // 65-85% saturation
  const l = 45 + (Math.abs(hash * 13) % 15); // 45-60% lightness
  
  const c1 = `hsl(${h}, ${s}%, ${l}%)`;
  const c2 = `hsl(${(h + 40) % 360}, ${s}%, ${l - 10}%)`;
  
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

export interface ClientTheme {
  color: string;
  glow: string;
  pillBorder: string;
  pillBg: string;
  fadeLineBg: string;
}

// 12 widely dispersed, highly vibrant neon hues on the color wheel
const DISTINCT_HUES = [
  190, // Cyber Cyan
  320, // Neon Pink
  30,  // Amber Gold / Orange
  260, // Cobalt Blue / Purple-Indigo
  95,  // Lime Green
  160, // Emerald Mint
  215, // Cyber Sky Blue
  340, // Hot Rose Red
  75,  // Bright Neon Yellow
  120, // Pure Vibrant Green
  290, // Deep Orchid / Violet
  15   // Fire Orange-Red
];

export function getClientTheme(clientName: string): ClientTheme {
  const norm = clientName.trim().toLowerCase();
  
  if (norm.includes('bench')) {
    return {
      color: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.35)',
      pillBorder: 'rgba(168, 85, 247, 0.15)',
      pillBg: 'rgba(168, 85, 247, 0.03)',
      fadeLineBg: 'linear-gradient(to right, rgba(168, 85, 247, 0.12), transparent)'
    };
  }
  if (norm.includes('brooksource')) {
    return {
      color: '#00f5a0',
      glow: 'rgba(0, 245, 160, 0.35)',
      pillBorder: 'rgba(0, 245, 160, 0.15)',
      pillBg: 'rgba(0, 245, 160, 0.03)',
      fadeLineBg: 'linear-gradient(to right, rgba(0, 245, 160, 0.12), transparent)'
    };
  }

  // Generate a distinct HSL color based on the client name hash
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Map hash to one of the 12 highly distinct hues
  const hue = DISTINCT_HUES[Math.abs(hash) % DISTINCT_HUES.length];
  
  const color = `hsl(${hue}, 95%, 55%)`;
  const glow = `hsla(${hue}, 95%, 55%, 0.35)`;
  const pillBorder = `hsla(${hue}, 95%, 55%, 0.15)`;
  const pillBg = `hsla(${hue}, 95%, 55%, 0.03)`;
  const fadeLineBg = `linear-gradient(to right, hsla(${hue}, 95%, 55%, 0.12), transparent)`;

  return {
    color,
    glow,
    pillBorder,
    pillBg,
    fadeLineBg
  };
}


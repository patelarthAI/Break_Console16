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

// 10 refined, low-saturation metallic/mineral HSL hue configurations
const PREMIUM_HUES = [
  { h: 215, s: 35, l: 62 }, // Sapphire Blue
  { h: 145, s: 28, l: 58 }, // Sage Green
  { h: 38,  s: 35, l: 58 }, // Amber Gold
  { h: 265, s: 30, l: 62 }, // Amethyst Purple
  { h: 15,  s: 30, l: 62 }, // Rose Copper
  { h: 175, s: 28, l: 58 }, // Teal Mint
  { h: 200, s: 35, l: 60 }, // Ocean Ice Blue
  { h: 5,   s: 30, l: 60 }, // Coral Red
  { h: 240, s: 25, l: 62 }, // Royal Indigo
  { h: 45,  s: 25, l: 55 }, // Antique Bronze
];

export function getClientTheme(clientName: string): ClientTheme {
  const norm = clientName.trim().toLowerCase();
  
  let colorProfile = PREMIUM_HUES[0]; // Default
  if (norm.includes('bench')) {
    colorProfile = { h: 265, s: 30, l: 62 }; // Amethyst Purple
  } else if (norm.includes('brooksource')) {
    colorProfile = { h: 145, s: 28, l: 58 }; // Sage Green
  } else {
    // Generate a distinct HSL color based on the client name hash
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    }
    colorProfile = PREMIUM_HUES[Math.abs(hash) % PREMIUM_HUES.length];
  }

  const { h, s, l } = colorProfile;
  const color = `hsl(${h}, ${s}%, ${l}%)`;
  const glow = `hsla(${h}, ${s}%, ${l}%, 0.22)`;
  const pillBorder = `hsla(${h}, ${s}%, ${l}%, 0.12)`;
  const pillBg = `hsla(${h}, ${s}%, ${l}%, 0.02)`;
  const fadeLineBg = `linear-gradient(to right, hsla(${h}, ${s}%, ${l}%, 0.08), transparent)`;

  return {
    color,
    glow,
    pillBorder,
    pillBg,
    fadeLineBg
  };
}



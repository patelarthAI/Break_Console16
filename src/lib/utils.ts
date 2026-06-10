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

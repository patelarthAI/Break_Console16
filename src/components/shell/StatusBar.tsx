'use client';

import KPITile from '@/components/ui/KPITile';

interface StatusCounts {
  all: number;
  working: number;
  on_break: number;
  on_brb: number;
  on_leave: number;
  logged_out: number;
  offline: number;
}

const TILES: Array<{ id: keyof StatusCounts; label: string; color: string }> = [
  { id: 'all', label: 'ALL', color: '#f8fafc' },
  { id: 'working', label: 'WORKING', color: '#10b981' },
  { id: 'on_break', label: 'ON BREAK', color: '#f59e0b' },
  { id: 'on_brb', label: 'BRB', color: '#3b82f6' },
  { id: 'on_leave', label: 'ON LEAVE', color: '#8b5cf6' },
  { id: 'logged_out', label: 'LOGGED OUT', color: '#64748b' },
  { id: 'offline', label: 'OFFLINE', color: '#475569' },
];

interface StatusBarProps {
  counts: StatusCounts;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function StatusBar({ counts, activeFilter, onFilterChange }: StatusBarProps) {
  return (
    <div className="max-w-[1400px] mx-auto w-full flex lg:grid lg:grid-cols-7 overflow-x-auto lg:overflow-x-visible gap-3 px-4 lg:px-6 py-3 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* CSS to hide webkit scrollbars inline since tailwind no-scrollbar might not be compiled */}
      <style jsx global>{`
        div::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>
      {TILES.map((tile) => (
        <KPITile
          key={tile.id}
          label={tile.label}
          value={counts[tile.id]}
          accentColor={tile.color}
          isActive={activeFilter === tile.id}
          onClick={() => onFilterChange(tile.id)}
        />
      ))}
    </div>
  );
}

export type { StatusCounts };

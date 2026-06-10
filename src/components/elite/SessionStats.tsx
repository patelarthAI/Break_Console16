'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatMs } from '@/lib/timeUtils';

interface StatRowProps {
  label: string;
  valueMs: number;
  color: string;
  glowColor: string;
  icon: React.ReactNode;
  isActive: boolean;
  progressPercent: number; // 0 to 100
}

function StatRow({ label, valueMs, color, glowColor, icon, isActive, progressPercent }: StatRowProps) {
  const boundedPercent = Math.min(100, Math.max(0, progressPercent));

  return (
    <div
      className="flex flex-col p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group/row border gap-3"
      style={{
        background: isActive 
          ? `linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)` 
          : 'rgba(255, 255, 255, 0.012)',
        borderColor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
        boxShadow: isActive 
          ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 30px rgba(0,0,0,0.65), 0 0 20px ${glowColor}10`
          : 'inset 0 1px 0 rgba(255,255,255,0.01), 0 4px 12px rgba(0,0,0,0.2)',
      }}
    >
      {/* Left indicator glow bar */}
      <div
        className="absolute left-0 top-[15%] bottom-[15%] w-[3px] rounded-r-md transition-all duration-500"
        style={{
          background: color,
          boxShadow: `0 0 16px ${color}, 0 0 4px ${color}`,
          opacity: isActive ? 1 : 0.35,
        }}
      />
      
      {/* Hover reflection light ray */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] via-white/[0.03] to-transparent -translate-x-full group-hover/row:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

      {/* Top Section: Labels, Icons, and Time */}
      <div className="flex items-center justify-between w-full relative z-10">
        {/* Label and Icon */}
        <div className="flex items-center gap-3">
          <div 
            className="transition-transform duration-300 group-hover/row:scale-110 flex items-center"
            style={{ 
              color: color, 
              opacity: isActive ? 1 : 0.65,
              filter: isActive ? `drop-shadow(0 0 8px ${color}50)` : 'none',
            }}
          >
            {icon}
          </div>
          <span
            className="text-[9px] font-black tracking-[0.16em] uppercase font-sans transition-colors duration-300"
            style={{
              color: isActive ? '#F3F4F6' : '#8E8E95',
            }}
          >
            {label}
          </span>
        </div>

        {/* Time value */}
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="text-lg font-bold font-mono tracking-tight tabular-nums transition-all duration-300"
            style={{
              color: isActive ? '#FFFFFF' : color,
              textShadow: isActive ? `0 0 16px ${glowColor}, 0 0 4px ${color}` : 'none',
            }}
          >
            {formatMs(valueMs)}
          </span>
          {isActive && (
            <span 
              className="text-[7px] font-black tracking-[0.12em] uppercase font-sans animate-[pulse_1.8s_infinite]"
              style={{ 
                color: color,
              }}
            >
              LIVE TRACKING
            </span>
          )}
        </div>
      </div>

      {/* Cybernetic Progress Bar - placed nicely inside card padding */}
      <div className="w-full relative z-10">
        <div className="h-[4px] bg-white/[0.03] rounded-full w-full overflow-hidden border border-white/[0.02]">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${boundedPercent}%`,
              background: `linear-gradient(90deg, ${color}60, ${color})`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface SessionStatsProps {
  workedMs: number;
  breakMs: number;
  brbMs: number;
  status?: string;
}

export default function SessionStats({ workedMs, breakMs, brbMs, status = 'idle' }: SessionStatsProps) {
  const totalBreakMs = breakMs + brbMs;

  // Usage bounds configuration for progress indicators
  const workedProgress = (workedMs / (8.5 * 60 * 60 * 1000)) * 100; // Target: 8.5 Hours standard shift
  const breakProgress = (breakMs / (60 * 60 * 1000)) * 100;        // Target: 60 Mins limit
  const brbProgress = (brbMs / (10 * 60 * 1000)) * 100;            // Target: 10 Mins limit
  const totalBreakProgress = (totalBreakMs / (85 * 60 * 1000)) * 100; // Target: 85 Mins combined limit

  return (
    <div className="flex flex-col gap-2.5">
      <StatRow
        label="WORKED"
        valueMs={workedMs}
        color="#10B981"
        glowColor="rgba(16, 185, 129, 0.4)"
        isActive={status === 'working'}
        progressPercent={workedProgress}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        }
      />
      <StatRow
        label="BREAK TIME"
        valueMs={breakMs}
        color="#F59E0B"
        glowColor="rgba(245, 158, 11, 0.4)"
        isActive={status === 'on_break'}
        progressPercent={breakProgress}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            <line x1="6" x2="6" y1="2" y2="4" />
            <line x1="10" x2="10" y1="2" y2="4" />
            <line x1="14" x2="14" y1="2" y2="4" />
          </svg>
        }
      />
      <StatRow
        label="BRB TIME"
        valueMs={brbMs}
        color="#3B82F6"
        glowColor="rgba(59, 130, 246, 0.4)"
        isActive={status === 'on_brb'}
        progressPercent={brbProgress}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        }
      />
      <StatRow
        label="TOTAL BREAK"
        valueMs={totalBreakMs}
        color="#8B5CF6"
        glowColor="rgba(139, 92, 246, 0.4)"
        isActive={status === 'on_break' || status === 'on_brb'}
        progressPercent={totalBreakProgress}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
      />
    </div>
  );
}
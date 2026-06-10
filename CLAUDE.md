# Brigade Pulse — CLAUDE.md

## Project Overview
**Brigade Pulse** is a premium recruiter time-tracking and compliance dashboard built for HR/staffing operations. It tracks punch-in/out, breaks, BRBs (Be Right Back), and enforces shift compliance rules for a team of recruiters spread across multiple clients.

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript 6
- **Styling:** Tailwind CSS v4 (`@theme` directive, CSS variables in `src/app/globals.css`)
- **Animation:** Framer Motion 12
- **Icons:** Lucide React
- **Backend:** Supabase (PostgreSQL + real-time)
- **PDF/Export:** jsPDF
- **3D:** Spline (@splinetool/react-spline)
- **Dates:** date-fns
- **Utilities:** clsx, tailwind-merge

## Project Structure
```
src/
├── app/
│   ├── globals.css          # Design system — CSS variables, glass effects, animations
│   ├── layout.tsx           # Root layout (fonts, background orbs)
│   └── page.tsx             # Entry point
├── components/
│   ├── ui/                  # Reusable primitives (StatCard, CustomSelect, DateRangePicker, etc.)
│   ├── admin/               # Admin-only components (LiveFloor, Settings, etc.)
│   ├── shell/               # App shell (Navbar, AppShell, LeftSidebar)
│   ├── sidebar/             # Sidebar widgets (EliteRankings, LeaveCalendar, etc.)
│   ├── MasterReports.tsx    # Reports dashboard ← PRIMARY target
│   ├── MasterLeaveTracker.tsx
│   ├── DailyLogEditor.tsx
│   └── ...
├── lib/
│   ├── store.ts             # Supabase data access (getAllUsers, getLogsBatch, etc.)
│   ├── timeUtils.ts         # Time computation (computeSession, formatDuration, checkViolations, etc.)
│   ├── statusMap.ts         # Status string → enum mapping
│   └── supabase.ts          # Supabase client
└── types/index.ts           # Core types: User, TimeLog, etc.
```

## Design System

### Color Palette
| Role | Value |
|------|-------|
| Background void | `#020203` |
| Background base | `#050507` |
| Background card | `#0A0A0F` |
| Background raised | `#101016` |
| Accent primary | `#A855F7` (purple) |
| Working/active | `#00F5A0` (neon emerald) |
| Break | `#FFD700` (gold) |
| BRB | `#D8B4FE` (light purple) |
| Leave | `#00E0FF` (cyan) |
| Logged out | `#FF2D55` (red) |

### Report-specific Colors
| Column | Color |
|--------|-------|
| Arrival | `#10d9b4` (teal) |
| Departure | `#f43f5e` (pink-red) |
| Net Active / BRB | `#5ba4f5` (sky blue) |
| Breaks | `#f59e0b` (amber) |
| BRBs | `#8b5cf6` (purple) |
| Violations | `#ef4444` (bright red) |

### CSS Variables (key)
- `--bg-void/base/card/raised/overlay/input` — depth layers
- `--accent`, `--accent-primary`, `--accent-glow` — purple brand
- `--border`, `--border-strong`, `--border-glow` — borders
- `--text-1`, `--text-2`, `--text-3` / `--text-primary`, `--text-secondary` — text
- `--r-card` (18px), `--r-btn` (12px), `--r-avatar` (14px) — radii

### Utility Classes
- `.glass-ultra`, `.glass-panel`, `.neural-card`, `.premium-card`, `.stat-card`
- `.status-working`, `.status-break`, `.status-brb`, `.status-leave`, `.status-clocked-out`
- `.text-stat-label`, `.text-stat-number`, `.text-glow`

### Fonts
- **Body:** Satoshi → Inter → system-ui
- **Display:** Cabinet Grotesk → Space Grotesk
- **Mono:** JetBrains Mono → ui-monospace

## Domain Logic

### Compliance Rules (hard-coded in timeUtils.ts)
- **Break allowance:** Max 1h 15m total break per day (`BREAK_LIMIT_MS`)
- **BRB max:** 10 minutes per day (`BRB_LIMIT_MS`)
- **Shift start:** 8:00 AM CST, grace until 8:05 AM
- **Shift end:** 5:00 PM CST (early out if before this)
- **Auto-logout:** When no punchOut for past days, a virtual 5 PM logout is applied

### Key Utility Functions (from `timeUtils.ts`)
```ts
computeSession(logs)           // → { punchIn, punchOut, breaks[], brbs[] }
computeWorkedTime(session, now, date, shiftEnd) // → ms
computeTotalTime(intervals, effectiveEnd) // → ms
countBreaks(logs) / countBRBs(logs)      // → number
checkViolations(...)           // → { breakViol, brbViol, lateIn, earlyOut, autoLogout, ...Ms }
formatDuration(ms)             // → "HH:MM:SS"
formatTime(ts)                 // → "08:05:23 AM"
dateStr(date)                  // → "YYYY-MM-DD"
exportExcel(rows, filename)    // → CSV download
```

### Key Store Functions (from `store.ts`)
```ts
getAllUsers()                          // → User[]
getLogsBatch(userIds, dates)           // → { [userId-date]: TimeLog[] }
getClients()                           // → ClientRow[]
getCurrentUser()                       // → User | null
```

### Types (from `types/index.ts`)
```ts
interface User { id, name, clientName, shiftStart, shiftEnd, timezone, isMaster }
interface TimeLog { id, userId, date, status, timestamp }
```

## Key Components

### MasterReports.tsx
The main reports dashboard. Contains:
- **`processLogsIntoRow()`** — converts raw `TimeLog[]` → `DayRow` with all computed fields
- **`summarize()`** — aggregates `DayRow[]` → `Summary` stats
- **`ViolBadge`** — shows compliance violations inline
- **`ReportTable`** — main data grid with per-row editing
- **`UserSummaryCard`** — per-user multi-day breakdown card
- **`MasterReports`** — root component, handles filters + data fetching

### DailyLogEditor.tsx
Modal for manually editing a specific recruiter's time logs for a day.

### DateRangePicker.tsx (382 lines)
Custom date range picker with presets: Today, Yesterday, This Week, Last Week, This Month, etc.

### StatCard.tsx
KPI tile with glow border, radial gradient, top accent line.

## Development Notes
- All components are client components (`'use client'`) unless noted
- Tailwind v4 uses `@theme {}` not `tailwind.config.js` — do not create a config file
- The app runs on `localhost:3000` via `npm run dev`
- No test suite is configured yet
- Supabase credentials are in `.env.local` (not committed)
- The `graphify-out/` and `scratch/` dirs are local tooling artifacts — do not modify

## Coding Conventions
- No comments unless non-obvious WHY
- No console.log in production code
- Use `toTitleCase()` from `@/lib/utils` for all name display
- Date strings are always `YYYY-MM-DD` format
- Timestamps are Unix ms (number)
- Colors hardcoded as hex strings inside components (not CSS vars) for report columns — this is intentional for readability

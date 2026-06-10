# Design

## Theme

Dark instrument-panel. Near-black background with purple aurora orbs, a subtle 52px spatial grid overlay, and a grain noise layer. The overall feel is a precision cockpit: dark glass, status color as the only accent, everything else resolving to near-black and near-white.

Color strategy: **Restrained** — near-void backgrounds, one status accent color at a time, near-white text. The status color (emerald / amber / violet / red) is sacred: it appears only where it signals state.

## Colors

### Background Depth

| Role | Value | Usage |
|---|---|---|
| Void | `#07060e` | Page background base |
| Surface | `#0b0a14` | Hero block, ControlCenter hero |
| Raised | `#0e0d14` | Cards, panels |
| Card | `#09090e` | Stat cards, inner tiles |
| Overlay | `rgba(255,255,255,0.025)` | Idle tiles, disabled elements |

### Aurora Background

Fixed radial gradients over the void:
- Purple top-right: `rgba(168,85,247,0.14)`
- Emerald bottom-right: `rgba(0,245,160,0.09)`
- Indigo bottom-left: `rgba(124,58,237,0.07)`

Body also has: 52px crosshatch grid at `rgba(255,255,255,0.03)`, faded radially. Grain noise at 2.8% opacity.

### Text

| Role | Value |
|---|---|
| Primary | `#F0F0F0` (94% white — never 100%) |
| Secondary | `rgba(255,255,255,0.55)` |
| Muted | `rgba(255,255,255,0.32)` |
| Faint | `rgba(255,255,255,0.18)` |
| Whisper | `rgba(255,255,255,0.09)` |

### Status Colors (the only accent system)

| Status | Color | RGB |
|---|---|---|
| Working | `#00F5A0` | 0, 245, 160 |
| On Break | `#FBBF24` | 251, 191, 36 |
| BRB | `#A78BFA` | 167, 139, 250 |
| Idle / Clocked Out | `#FF2D55` / `#6B7280` | varies |

Status colors are used at full hex for glows and tips, at `{color}38`–`{color}55` for borders, and at `{color}0f`–`{color}1e` for background tints. Never use multiple status colors simultaneously — only the current status color is active.

### Borders

| Role | Value |
|---|---|
| Default card border | `rgba(255,255,255,0.07)` |
| Raised border | `rgba(255,255,255,0.05)` |
| Top highlight | `rgba(255,255,255,0.12)` |
| Status border (active) | `rgba({status_rgb},0.40)` |

## Typography

Three typefaces, three clear roles. Never mix within a role.

| Face | Family | Weights | Role |
|---|---|---|---|
| Display | Cabinet Grotesk | 700, 800 | Section headers, top-bar brand, short labels (≤4 words) |
| Body / UI | Satoshi | 400, 500, 600, 700 | All UI text, labels, pills, descriptions |
| Data / Mono | Geist Mono | 400, 500, 600 | All numbers (clock, stat values, timestamps), keyboard hints |

### Scale

| Name | Size | Weight | Family | Usage |
|---|---|---|---|---|
| Clock | 42–52px | 600 | Geist Mono | H:M digits in clock face |
| Stat value | 20–23px | 500 | Geist Mono | Stat card values |
| Label | 9.5–11px | 700 | Satoshi | Uppercase card labels (≤4 words) |
| Body | 12–13px | 500–600 | Satoshi | Tile labels, descriptions |
| Sub | 9–10px | 500–600 | Satoshi | Tile subtitles, timestamps |
| Mono small | 9–12px | 400–500 | Geist Mono | Seconds, keyboard shortcuts |

Letter-spacing: `0.14–0.20em` on uppercase labels only. Never on body copy.

`font-variant-numeric: tabular-nums` on all data values to prevent layout shift.

## Spacing

Base unit: 8px. Common values: 4, 7, 8, 10, 12, 14, 16, 18, 20, 24.

Gap between grid columns: 12px. Gap between sections: 8px. Internal card padding: 11–18px.

## Radii

| Size | Value | Usage |
|---|---|---|
| sm | 8px | Badges, LIVE chips, kbd elements |
| md | 14px | Stat cards, inner tiles |
| lg | 16–18px | Action tiles |
| xl | 20px | Hero block, ControlCenter card |
| pill | 100px | Status pills, LIVE indicators |

## Shadows

Cards: `0 24–28px 70–80px rgba(0,0,0,0.90), inset 0 1px 0 rgba(255,255,255,0.05)`. No upward glow on shadows — light source is always top-down.

Glows come from the element's status color via `drop-shadow` on SVG elements and `box-shadow` with `{color}` at low alpha on containers.

## Motion

### Timing Hierarchy

| Priority | Type | Duration | Easing |
|---|---|---|---|
| 1 | Status change event | 400–800ms | Spring (stiffness 500, damping 34) |
| 2 | Data ring progress | 1.0–1.2s | `[0.4,0,0.2,1]` cubic |
| 3 | Card state transition | 0.55s | `cubic-bezier(0.4,0,0.2,1)` |
| 4 | Hover response | 0.15–0.18s | ease |
| 5 | Ambient breathing | 6–9s | easeInOut, repeat Infinity |
| 6 | Decoration | 0ms | — (remove it) |

### Named Animations (globals.css keyframes)

- `statusPulse` — 2s pulse on the status dot
- `timerFade` — 1s blink on the colon separator
- `status-pill-enter` — 0.45s spring-bounce on pill mount
- `status-line-enter` — 0.5s scaleX sweep on top accent line
- `action-fade-up` — 0.35s slide-up on button re-entrance
- `aurora-float` / `aurora-float-b` — 18–24s slow drift on background orbs

### Motion Rules

- Ambient motion (breathing glows, aurora) must be ≤ 15% of animation budget. It never competes with event motion.
- `@media (prefers-reduced-motion: reduce)`: all ambient animations stop. State transitions drop to 200ms opacity crossfade.
- Disabled elements: no hover animation, no scale, cursor `default`.

## Components

### ControlCenter (left panel, 420px)

The personal time-tracking instrument for the logged-in user. Three vertical sections:

**Hero block** (`#0b0a14`, rounded-20, dot-grid texture background):
- Top row: date label (Satoshi 9.5px, uppercase, 0.20em tracking) + status pill (animated on change)
- Center: 200px SVG clock face
  - 60 tick marks at r=97 (major every 5 ticks, status color at 0.35 alpha; minor white at 0.09)
  - Ring 1 (r=90, 4px): shift worked progress, status color, glow drop-shadow, white+status tip dot
  - Ring 2 (r=74, 2.5px): break budget consumed, amber `#FBBF24`, independent of status
  - Ring 3 (r=58, 1.5px): live seconds, status color at 0.32 alpha, faint tip
  - Center text: 42px H:M (Geist Mono 600) + 10px AM/PM·seconds line + "Xh Ym left" countdown
- Bottom: 2 stat cards side by side (Worked + Breaks/BRB)

**Action tiles** (2×3 grid, 78px each):
- Background: near-invisible when disabled (opacity 0.28), gradient tint when primary
- Icon: 36px circle container, 17px icon
- Primary action: status-colored border + top accent line + box-glow
- Hover: `scale(1.02)`, spring spring (700/36)
- Press: `scale(0.95)`

**Keyboard hints**: `[P] [B] [R]` keys, 17px kbd elements, Geist Mono 7.5px

### StatCard

Rich gradient background, 14px radius, `backdrop-filter: blur(20px)`.
- Live state: gradient from `{color}20` → `{color}07`, border `{color}40`, corner glow
- Idle state: `rgba(255,255,255,0.030)` flat, border `rgba(255,255,255,0.065)`
- Top accent line: 1.5px gradient, bright on live, faint on idle
- Value: 21px Geist Mono 500, `tabular-nums`
- Progress bar: 2.5px, gradient from `{color}45` → `{color}`, glows when live

### Timeline (center column)

Activity feed — scrollable, `flex:1 minHeight:0`. Each log entry is a Framer Motion `layout` item with spring enter/exit. Timestamps in Geist Mono. Event type in Satoshi 700 uppercase.

### RightPanel (right column, 280px)

Three sections: Team Status, Aura Maxers (break discipline leaders), Lobby Campers (over-break). Section headers in Cabinet Grotesk 10px uppercase. Each member row: avatar initial + name (Satoshi) + client sub (Cabinet Grotesk 8px). Quote block in italics with serif-style Cabinet Grotesk. All in a `rp-scroll` overflow container.

### TopBar

52px sticky header. Left: logo (26px) + "Breakthrough Brigade" (Cabinet Grotesk 800, 0.8rem). Right: LIVE badge (Geist Mono 8.5px, emerald pulse) + user chip (26px avatar circle, Satoshi 11px name, Cabinet Grotesk 8px client) + logout icon.

## Layout

Three-column grid (EliteDashboard):

```
420px | minmax(0,1fr) | 280px
```

12px column gaps. 12px top padding, 14px bottom padding. `minHeight:0` on all grid tracks. `overflow:hidden` on the page — no page scroll. Each column scrolls internally where needed.

`gridTemplateRows: minmax(0,1fr)` — prevents track inflation in flex context (critical for scroll).

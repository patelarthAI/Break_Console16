# Product

## Register

product

## Users

Two audiences, two views of the same system.

**Recruiters** (primary): Individual contributors at staffing clients (Brooksource, Ampcus, FPG, etc.). They open the dashboard at the start of their shift and leave it running all day. Their primary task is clocking in/out and managing breaks within compliance rules. The dashboard is their personal workday instrument — always visible, always live.

**Managers / Admins** (secondary): Team leads and operations staff who monitor recruiter compliance across the floor in real time. They use the admin AppShell: LiveFloor, MasterReports, leave tracking. Their job is oversight, not personal time tracking.

## Product Purpose

Brigade Pulse is a recruiter time-tracking and compliance enforcement platform for staffing operations. It tracks punch-in/out, breaks, BRBs (Be Right Back), and enforces shift compliance rules (8.5h shifts, 75m break budget, 10m BRB cap). Success means every recruiter on the floor is compliant, every manager has real-time visibility, and nobody has to open a spreadsheet.

## Brand Personality

Elite · Dynamic · Futuristic

The dashboard should feel like a precision instrument — a Rivian R1T cluster or Apple Watch Ultra face, not a timesheet app. It commands authority. The clock is the hero. Data is live and unapologetic. Motion is purposeful and specific, never decorative. The product is the one piece of software on a recruiter's screen that feels like it was engineered, not assembled from a component library.

## Anti-references

- **Generic HR SaaS** (BambooHR, Workday, Kronos): boxy, blue-grey, corporate, flat. Feels like a timesheet, not a cockpit. Never default to bordered cards with icon + label + value repeated in grids.
- **Light-mode dashboard**: white cards, drop shadows, 2019 Bootstrap admin panel energy. The product is dark by design — screens emit light, dark backgrounds are the natural medium.
- **Over-animated startup UIs**: every element glowing, orbiting, pulsing simultaneously. Decoration masquerading as design. Motion only earns its place when it communicates something.

## Design Principles

1. **The clock is the instrument, not a widget.** The time display is the dominant element on the recruiter's screen. Every design decision serves its legibility and authority.
2. **Color is signal, not style.** Status colors (emerald/amber/violet/red) appear because they communicate state, not because they look exciting. When everything glows, nothing signals.
3. **Motion encodes meaning.** Every animation communicates a state change, a data update, or a transition. Ambient motion (breathing glows, tick marks) must be slower and quieter than event motion (status changes, energy waves).
4. **Disabled is invisible.** Elements the user cannot currently act on should visually recede — not disappear, but step back. Opacity, not hiding. The primary action owns the room.
5. **Data density earns trust.** "3h 28m left in shift" on the clock face, break budget as a ring, seconds as a tick — information that no generic HR tool ships is what makes this feel engineered.

## Accessibility & Inclusion

- WCAG 2.1 AA minimum for all interactive elements and text.
- Status communication must never rely on color alone — status pills carry text labels alongside color dots.
- Reduced motion: all ambient animations (`breathing`, `aurora-float`, `statusPulse`) should respect `prefers-reduced-motion: reduce`.
- All action tiles are keyboard-accessible with visible focus states.
- Font sizes: body minimum 11px, interactive labels minimum 10px.

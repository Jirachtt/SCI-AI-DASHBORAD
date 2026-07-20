# SCI AI Dashboard Design System

This file adapts `DESIGN.md` into an operational design system for the Faculty
of Science, Maejo University. Product usability, accessibility, data accuracy,
and the existing workflows take precedence over visual references.

## Product Character

- Intelligent decision-support command center, not a marketing website.
- Calm, precise, trustworthy, and dense enough for repeated daily use.
- MJU green is a brand and action accent, not a full-page wash.
- Dark mode uses deep navy-neutral surfaces rather than pure black.
- Light mode uses warm white, cool gray, and ink navy with restrained depth.
- Thai and English use `Noto Sans Thai` with tabular numerals for metrics.

## Core Tokens

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | `#071019` | `#f5f6f4` |
| Surface | `#101b28` | `#ffffff` |
| Soft surface | `#0c1723` | `#f3f5f3` |
| Primary text | `#f8fbff` | `#17212b` |
| Secondary text | `#d8e2ec` | `#3d4b5b` |
| Muted text | `#a8b5c4` | `#637184` |
| MJU action | `#18a966` | `#006838` |
| Information | `#38bdf8` | `#1863dc` |
| Warning | `#fbbf24` | `#b77900` |
| Danger | `#fb7185` | `#c7374f` |

Use semantic CSS variables from `src/design-system.css`; do not hard-code these
colors in page components unless the value represents data semantics.

## Typography

- Font family: `Noto Sans Thai`, system-ui fallback.
- Page title: 20-25px, 760 weight, solid text color.
- Section title: 16-18px, 700-740 weight.
- Body: 14-15px, 400-560 weight, 1.5-1.65 line height.
- Supporting label: 12-13px, 520-650 weight.
- KPI values use tabular numerals and must reserve stable space while loading.
- Never use gradient text, negative letter spacing, or viewport-scaled body type.

## Layout And Density

- Desktop sidebar remains 264px; command header remains 64px.
- Page content uses a centered maximum width without changing existing content
  order, card groupings, or route behavior.
- Use an 8px spacing rhythm with 4px only for tight icon/label relationships.
- Controls are 42-44px high; frequent mobile targets are at least 44px.
- Cards use 8-12px radii; framed panels and modals may use 14px.
- Avoid cards inside cards. Inner metric cells use quiet grouped surfaces.
- Tables keep their data model and scroll horizontally only inside their frame.

## Components

### Sidebar And Header

- Navigation groups remain permission-aware and scan-friendly.
- Active navigation uses one solid MJU green state with white text.
- Featured AI remains prominent but uses restrained depth and no looping glow.
- Header shows app/page context and only necessary actions.
- Mobile navigation stays an overlay drawer and supports Escape.

### KPI Cards

- Value first, label second, trend or provenance third.
- Color is reserved for meaning; icons must not compete with the value.
- All cards in a metric row share height and internal alignment.
- Missing data is shown as unavailable, never silently converted to zero.

### Tables And Filters

- Sticky table headers, subtle row separators, and visible keyboard focus.
- Filter/search controls form one operational toolbar rather than floating inputs.
- Empty, loading, error, live, fallback, and calculated states remain distinct.
- First-column stickiness is used only on narrow screens and kept compact.

### Charts

- Chart palettes are theme-aware and category colors remain distinguishable.
- Grid lines are quiet; axis labels and legends remain readable.
- Tooltip uses the hovered data index and clears when the pointer leaves.
- Motion is a one-time explanatory reveal, never a looping decoration.
- Preserve dataset order, formulas, drilldowns, filters, and export behavior.

### AI Chat

- Conversation and composer are the primary surface.
- Quick actions, context, history, upload, voice, and chart generation remain.
- AI status and provenance are compact, understandable, and role-aware.
- Streaming content reserves space and never steals scroll from older messages.

### Login And Admin

- Login communicates institutional trust without becoming a landing page.
- Admin remains an operational management tool, not an executive summary page.
- Authentication methods, permissions, approval, role dates, sync, audit, and AI
  usage behavior must not change during visual work.

## Interaction And Accessibility

- Motion durations: 120ms press, 180ms controls, 240ms panels, up to 700ms charts.
- Animate `transform` and `opacity`; do not animate layout dimensions.
- Every interactive element has a visible focus ring and meaningful accessible name.
- Important text meets WCAG AA contrast; status never relies on color alone.
- Respect `prefers-reduced-motion` and remove nonessential motion on mobile.
- Avoid hover-only access to information and prevent layout-shifting hover effects.

## Forbidden Patterns

- Marketing heroes, sales CTAs, mega menus, logo carousels, or decorative imagery.
- Green-washed pages, rainbow header borders, gradient headings, or glowing orbs.
- Oversized rounded cards, nested cards, bouncy motion, or infinite pulse effects.
- Hidden overflow that clips text, controls, tooltips, tables, or chart labels.
- Replacing Lucide icons with emoji or manually drawn interface SVGs.
- Visual changes to auth, API, Firebase, AI/RAG, permissions, calculations, or data.

## Delivery Checklist

- Light and dark mode verified at 1920, 1440, 1280, 768, and 390px.
- No page-level horizontal overflow; table overflow remains inside table frames.
- Charts, tooltips, drilldowns, filters, sync, exports, AI, and role controls work.
- Keyboard focus, Escape handling, reduced motion, and screen-reader labels work.
- `git diff --check`, lint, presentation smoke tests, and production build pass.

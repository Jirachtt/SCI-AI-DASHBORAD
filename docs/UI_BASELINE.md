# SCI AI Dashboard UI Baseline

Baseline commit: `e1b2f0a`

This document records the layout and interaction contracts that must remain
intact during the modern UI upgrade. DESIGN.md is a visual reference only;
the current product workflows remain the source of truth.

## Shell Contract

- Desktop sidebar width: 264px.
- Main header height: 64px.
- The sidebar is grouped by permission-aware navigation categories.
- The featured AI entry remains visually prominent and keeps its current route.
- Mobile navigation uses the existing overlay drawer, closes after navigation,
  and supports Escape.
- The top header keeps the current page/app context and theme switch.
- Route changes scroll the window, main content, and page content to the top.
- Page content remains dashboard-dense; no marketing hero is introduced.

## Layouts To Preserve

- Overview: KPI summary row, domain cards, insights, and existing card order
  customization.
- AI Chat: command center/context sources, quick actions, history, upload,
  voice, chart responses, and the sticky composer.
- Student and TCAS: current chart/table order, filters, drilldowns, and export
  controls.
- Finance, budget, graduation, HR, research, and strategic pages: current data
  groupings and chart placement.
- Admin: operational user management, approvals, role duration controls, sync,
  data accuracy, audit, and AI usage panels.
- Login: email/password, Google, MJU SSO, and Admin access flows.

## Functional Freeze

- Firebase/API loading and realtime updates.
- MJU login, callback, logout, and session persistence.
- Role filtering, route guards, direct URL protection, and data row limits.
- AI streaming, RAG, quick actions, uploads, voice, history, and chart creation.
- CSV/Excel/PDF/chart-image export behavior.
- Chart hover, tooltip data index, drilldown, zoom, and filtering.
- Token usage, request count, model status, and admin usage controls.
- Existing empty, fallback, calculated, and live-data distinctions.

## Visual Strengths To Keep

- Noto Sans Thai typography and readable Thai labels.
- Dark theme persistence and theme-aware chart colors.
- Restrained MJU green brand accents.
- Lucide icon language.
- Existing responsive content order and mobile table scrolling.
- Compact operational density rather than landing-page composition.

## Areas To Improve

- Consolidate surface, border, shadow, radius, focus, and motion tokens.
- Reduce nested-card appearance and overly rounded containers.
- Tighten section-header and toolbar spacing while preserving actions.
- Increase light/dark muted-text contrast and keyboard focus visibility.
- Standardize KPI dimensions, table headers, filter controls, and empty states.
- Improve chart legend/tooltip hierarchy without changing datasets.
- Polish AI composer and response surfaces without changing the AI pipeline.
- Reserve stable space for asynchronous values to avoid layout shift.

## Baseline Artifacts

Temporary screenshots are stored under `.codex-run/ui-baseline/` and are not
committed. The primary captures are Login and Admin in light/dark desktop and
mobile states. Existing route captures under `.codex-run/design-md/` remain
available for cross-checking dashboard pages that require non-admin roles.

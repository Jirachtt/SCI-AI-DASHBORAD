# SCI AI Dashboard UI Verification

## Scope

This verification covers the visual-system upgrade on `codex/world-class-modern-ui`.
The work is intentionally limited to presentation, responsive behavior, chart
readability, and accessibility. Authentication, Firebase, synchronization, AI
routing, role permissions, exports, and business calculations remain unchanged.

## Visual checks

- Light and dark theme tokens use the same surface, border, text, status, and focus hierarchy.
- Sidebar and command header remain compact and preserve role-based navigation.
- KPI cards, chart cards, tables, filters, modal surfaces, Login, AI Chat, and Admin use shared component rules.
- Mobile Admin was checked at 390 x 844 with no document-level horizontal overflow.
- Desktop Admin was checked at 1440 x 900 in dark mode.
- Reduced-motion rules remove entrance, chart, thinking, and send animations where requested.

## Automated checks

- `npm run lint`: pass
- `npm run build`: pass
- `npm run smoke:presentation`: 29/29 pass
- `npm run audit:ai-usage`: 9/9 pass
- `npm run verify:stability`: pass
  - Executive AI set: 50 cases
  - Student realtime: 14/14
  - Role access: 34/34
  - Navigation: 18 route items
  - Data consistency: 34 pass, 2 existing source-quality warnings, 0 fail

## Known data-source limitations

- Some TCAS history/funnel rows remain presentation data until a Reg/Admissions endpoint is connected.
- Graduation completion history remains presentation data until a Reg/Graduation endpoint is connected.
- These limitations predate and are independent from the visual-system changes.

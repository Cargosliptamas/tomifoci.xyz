# Tomifoci 2026 — Design rebuild reference

This app is a faithful React+Tailwind rebuild of the three `design_handoff` `.dc.html`
prototypes. The exhaustive extracted spec (every token, Hungarian copy string, dimension,
and interaction) lives in the project journal / handoff. Key invariants:

- BROADCAST tokens only (see app/globals.css). Teal text = #007E73, never #00B8A9 for text.
- Player bg #EAF6F5; broadcast-dark islands for live/finished cards.
- Inter font; tabular-nums on all numbers; tap targets >=44px.
- Accordion feed: one card open at a time; caret rotates 180; transform-only entrance.
- Steppers clamp 0-20; editing marks unsaved.
- Admin: confirm -> mutate -> audit toast "* ... naplozva" -> recompute banner.
- Hungarian copy is verbatim from the prototypes; EN only for landing/login.

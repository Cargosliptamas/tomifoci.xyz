# Tomifoci 2026 — Frontend Redesign Journal (for AI / dev handoff)

Date: 2026-06-28 · Author: Claude Design · Status: **Concept B + Admin + Brackets delivered (design). Concept A retired.**

This journal lets another AI or developer wire the redesigned UI to the existing backend
without re-deriving intent. It pairs with `uploads/redesign-frontend-backend-inventory.md`
(the FE-/BE- functional inventory) and the repo's `SPEC_DIGEST.md`, `BRAND_BOOK.md`,
`UI_STANDARDS.md`.

## What was built
- **`Tomifoci 2026 — Concept A.dc.html`** — a single streaming Design Component containing:
  - **Landing** (HU/EN switch, logo hero, 3-mode pitch, Enter CTA, interest link) → FE-003/004, BE-031
  - **Login** (player select grid + search → 4-digit PIN pad, biometric note) → FE-005/006/007/010, BE-001/002/032
  - **Player app** with bottom-nav (mobile) / sidebar (≥920px):
    - **Toplista / Leaderboard** with scope chips (Összes/VB-teljes/Csoportkör/Kiesés/Wizard), podium, is-me row → FE-011, BE-001/013/029
    - **Tippek / Predictions** with scoring infographic + thumb steppers + save states → FE-013/014, BE-005
    - **Wizard of ODDS** 1/X/2 segmented picks with odds → FE-016/017, BE-021/022
    - **Svájci / Swiss** round duel + standings (BÉTA) → FE-018, BE-023/024/025
    - **Meccsek / Match centre** live + finished broadcast cards + upcoming list → FE-019/020, BE-001/017/018
    - **Profil** stats, favorite, settings list → FE-015/022/023, BE-002/006/016

- **`Tomifoci 2026 — Concept B.dc.html`** — same backend/data, **reorganised mechanics**:
  - **Match-day hub** is the home screen: every fixture is ONE fused card. Tap to expand →
    play all three modes in place: 🎯 score steppers (mode 1) + 🪄 Wizard 1/X/2 (mode 2) +
    ♟ Swiss round/opponent impact line (mode 3). One "Mentés" saves prediction + pick together.
    Live/finished fixtures show a per-mode points breakdown inline. Collapsed cards show a
    status chip (kész / tipp / nincs tipp) + a daily completion ring.
  - **Unified Tabella**: a single standings screen with a 🎯/🪄/♟ segmented switch instead of
    three separate ranking surfaces. Tippjáték keeps the scope chips.
  - **3-item nav** (Meccsek / Tabella / Profil) — the hub absorbs Tippek+Wizard+Svájci.
  - Profile shows per-mode rank (🎯 2. · 🪄 5. · ♟ 2.). Landing leads with the fused-card preview.
  - **Concept A retired** — Concept B is the chosen direction (file removed from the project).

- **`Tomifoci 2026 — Brackets.dc.html`** — converging March-Madness brackets for the **Párbaj
  playoff** (5-round / 32-player) and the **WC knockout**, plus a **consolation / placement tree**
  (5–8 placement + bronze). Fills the knockout half of Groups/Bracket (FE-021); the 12-group tables
  + best-third matrix still need building. Current player / favourite highlighted; bracket geometry
  is computed in the logic class (card 140×54, gap 34, pitch doubles per round) — port to an
  SVG/flex bracket or CSS grid in the target stack.

## Design system used (from repo, do not invent new hues)
- "BROADCAST" palette: primary teal `#00B8A9`, dark/hover `#009B8F`, **teal-as-text `#007E73`**
  (AA), bg `#EAF6F5`, cards `#FFF`, ink `#0D3331`. Broadcast dark cards: live
  `#0C4D49→#0F6A64`, done `#073B43→#0B5560`, infographic `#1d6b74→#14525a`. gold `#FFD700`,
  live red `#FF3B30`, ok green `#15803d`.
- Font **Inter** 400–900, `tabular-nums` on all numbers. Tap targets ≥44px. Emoji as
  functional markers (⚽🪄♟🏆⭐🔴🎯). Reuse `logo.png`, `favicon.svg`.

## State currently mocked in the DC (replace with real backend)
All data lives in the `Component` logic class as constants — swap for the **`game:state`** payload
(now served from **Vercel + Neon**, not Convex):
- `BOARD` ← `state.rankings` / `playerScores` (scope-filtered; build from roster, see INV-04)
- `MATCHES` ← static schedule (`data.js`) + `results` + `apiCache`
- `ODDS` ← `apiCache` odds (kickoff snapshot for Wizard, see WIZ-02/05/13)
- `SWISS` ← `swissStandings` (display-only, derived; SWISS-16/17)
- `preds` / `wiz` local state ← `predictions` / `wizardPicks` for current player
- PIN pad: **demo accepts any 4 digits.** Wire `auth:checkPlayerPin` (BE-002); enforce
  server-side kickoff lock (INV-10) on save.

## What still needs doing
1. ~~Concept B~~ — **done** (`Tomifoci 2026 — Concept B.dc.html`).
2. **Admin operations console** — FE-025…FE-036 (players, results/KO, override, bonuses, Swiss
   admin, LiveScore diagnostics, txn rollback, deleted-player restore, leads w/ mark-handled,
   gated import/export). Pending — design as a first-class console, not a placeholder.
3. **Wire mutations** grouped per the inventory's interface split (auth/predictions/favorites/
   results/wizard/swiss/notifications/health/import-export).
4. **Resolve open product decisions** before locking screens: canonical post-login route,
   EN launch, prediction privacy pre-kickoff, Swiss auto-participation finality, Wizard opt-in,
   admin role tiers, import safeguards (see inventory §E.10 and SPEC_DIGEST OQ-1…OQ-6).
5. **States not yet drawn:** offline/stale banner, recomputing, push-permission-denied,
   service-worker update, locked-match, wrong-PIN (PIN error path is stubbed in logic).

## Build/stack notes
- Target stack per brief: **Turborepo + Tailwind UI**. This DC is a self-contained HTML
  prototype for design sign-off; when porting to the monorepo, map the inline BROADCAST styles
  to Tailwind tokens (the hex values above) and reuse Tailwind UI primitives for nav, lists,
  forms, modals.
- Keep the **domain/data model fixed**, but persistence is **Vercel + Neon (Postgres)** via the
  `apps/rewrite` Drizzle schema (Convex is being retired — keep the shapes, move the storage). Any
  field the UI needs that the `game:state` shape doesn't return = new backend work — flag it.

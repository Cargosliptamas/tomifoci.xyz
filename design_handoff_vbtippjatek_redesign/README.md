# Handoff: VB Tippjáték 2026 — Frontend Redesign (Tomifoci)

> Package for **Claude Code** (or any developer) to implement the redesigned frontend
> in the `Cargosliptamas/Vb_Tippjatek_2026` repository. Self-contained: you should be
> able to build from this README alone, with the bundled files as visual reference.

---

## Overview

**Tomifoci** is a 2026 World Cup prediction game for ~35 friends + 1–2 admins, in Hungarian.
It has **three game modes** played on the same fixtures:

1. **Tippjáték (Score predictor)** — predict exact scores; tiered points 5/3/2/1.
2. **Wizard of ODDS** — pick 1/X/2; a correct pick scores the bookmaker odds at submission (clamped 1.10–10.0).
3. **Svájci Liga (Swiss, BETA)** — your round's 8-match base points duel a paired opponent.

This handoff delivers a **from-scratch, mobile-first redesign**: two player-app concepts, a
landing, and a full admin operations console. The **persisted game/domain model is FIXED** — but
the backend now runs on **Vercel + Neon (Postgres)** (the `apps/rewrite` path), not Convex. The UI
must fit the existing data contract; any field a screen needs that the backend doesn't already
return is **new backend work and must be flagged**, not silently assumed.

---

## About the design files

The `*.dc.html` files in this bundle are **design references** — interactive HTML prototypes
showing intended look, layout, and behavior. **They are not production code to copy.** They are
authored in a streaming "Design Component" format and use mocked, in-file data.

**Your task:** recreate these designs in the target codebase's environment. Per the project brief
the stack is a **Turborepo monorepo with Tailwind** — build the UI with **Tailwind UI** components
and any reusable code already in the repo, mapping the inline styles here to Tailwind tokens. Wire
screens to the **Vercel + Neon** backend via the Next API routes / server actions (e.g.
`/api/state`, `/api/auth/player-pin` in `apps/rewrite`); the read model keeps the **`game:state`
shape**, now served from Neon (Postgres) instead of Convex. Do **not** ship the HTML directly.

To view a prototype: open it in the original design project (they depend on that project's DC
runtime). Screenshots are not bundled by default — ask if you want them added.

---

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, component structure, copy (Hungarian),
and interactions are intentional and taken from the repo's existing **"BROADCAST" design system**
(`BRAND_BOOK.md`, `UI_STANDARDS.md`). Recreate the UI faithfully using Tailwind UI primitives.
Mocked data (player names, scores, odds, fixtures) is placeholder — replace with live backend data.

---

## What to build

The player app is **Concept B** — the product owner's chosen direction. (Concept A, a mode-per-tab
variant, was explored and **retired**; it is not part of this build.)

- **Concept B — Match-day hub:** the home screen is a chronological fixture feed. Each fixture is
  **one fused card**; tapping it expands in place to play all three modes at once (🎯 score steppers,
  🪄 Wizard 1/X/2, ♟ Swiss impact line). Standings collapse into a **single "Tabella" screen** with
  a 🎯/🪄/♟ segmented switch. 3-item nav: Meccsek / Tabella / Profil.
- **Brackets:** a dedicated converging knockout view (`Tomifoci 2026 — Brackets.dc.html`) for the
  **Párbaj playoff** (5-round, 32-player) and the **WC knockout** — March-Madness style with a
  consolation / placement tree. Integrate into B under Svájci/Párbaj and a Kiesés entry.
- **Admin console:** one shared operational design.

---

## Design tokens (BROADCAST system — do not introduce new hues)

### Color
| Token | Hex | Use |
|---|---|---|
| primary teal | `#00B8A9` | fills, borders, bars, decorative accents (UI ≥3:1 only) |
| primary dark | `#009B8F` | gradient/hover end |
| **teal-as-text** | `#007E73` | **teal text & numbers on light (AA 4.96), and fill behind white text.** Never use `#00B8A9` for text. |
| primary gradient | `#00C9BA → #00A99B` | primary buttons / bars |
| bg | `#EAF6F5` | app background (player) |
| surface card | `#FFFFFF` | cards |
| surface 2 / 3 | `#EBF6F5` / `#DCEFEE` | insets, borders |
| ink / text | `#0D3331` | body (13.7:1) |
| text-muted | `rgba(13,51,49,.70)` / `.62` | secondary / tertiary |
| me-row bg / border | `rgba(20,160,140,.14)` / `#14a08c` | "this is you" highlight |
| gold / silver / bronze | `#FFD700` / `#D6DCE3` / `#CD7F32` | podium, point pills |
| live / red | `#FF3B30` | live dot, destructive |
| ok / green | `#34C759` / `#15803d` | success (use `#15803d` for green text, AA 5.02) |
| warn | `#FF9500` | warnings, "nincs tipp" |

**Broadcast dark "islands"** (white text both themes — used for live/finished match cards & infographics):
- live: `linear-gradient(160deg,#0C4D49,#0F6A64,#0C524E)`
- finished: `linear-gradient(160deg,#073B43,#0B5560)`
- infographic / rules: `linear-gradient(160deg,#1d6b74,#14525a)` (also `#0C5258→#08363C`); text `#eaf7f6` / `#cfeae8`.

**Admin "control-room" palette** (calmer, more operational): bg `#EDF2F2`, card `#FFFFFF`,
border `#E1EAEA`, danger `#E5484D`, success chip bg `#e4f5ea`/border `#c2e6cf`, warn chip bg
`#fff7e6`/border `#f3d9a6`. Admin uses a **monospace** (JetBrains Mono) for IDs, timestamps,
versions, and freshness values.

### Type
**Inter** (Google Fonts), weights 400–900. All numbers `font-variant-numeric: tabular-nums`.
Eyebrows: 900, uppercase, letter-spacing ~.12–.14em, muted. Scale (rem):
`.62 / .70 / .80 / .90 / 1 / 1.25 / 1.6 / 2 / 3`.

### Spacing / radius / motion
- Spacing (4px base): `4 8 12 16 20 24 32`.
- Radius: `8 / 12 / 16 (cards) / 20 (sheets) / 999 (pills)`.
- Tap targets **≥44px**.
- Motion durations 140 / 240 / 420ms. **Entrance animations must be transform-only (no
  opacity:0 start)** so content is never hidden when a tab is backgrounded; respect
  `prefers-reduced-motion`.

### Layout
Mobile-first centered column (~480–600px). At **≥920px** the nav becomes a left sidebar
(~240px) + content grid; cap content ~1200px. Bottom tab bar on mobile, sidebar on desktop.

### Assets
`assets/logo.png` (app mark — Atlas figures + 2026 ball + "tomifoci.xyz", on teal),
`assets/favicon.svg`. Flags are **emoji**; team names are Hungarian (see repo `data.js` for the
full 12-group, 48-team list + `FLAGS` map + `MATCHES` schedule). Emoji are functional brand
markers: ⚽ matches · 🪄 Wizard · ♟ Svájci · 🏆 league · ⭐ favourite · 🔴 live · 🎯 scoring.

---

## Screens / Views

> FE-/BE- IDs reference `functional-inventory.md`. Per-screen → backend mapping is also in
> `REDESIGN_JOURNAL.md`. Copy text below is the exact Hungarian used.

### Shared — Landing  (FE-003/004)
Teal radial-gradient hero. Top bar: wordmark + **HU/EN** pill toggle. Center: eyebrow
"VB 2026 · Tippjáték", H1 headline, sub, primary **"Belépés →"** CTA, secondary underline
"Még nem játszol? Jelezz érdeklődést" (→ interest, BE-026). Concept B's landing additionally
shows a **fused-card preview** (one match card with 🎯/🪄/♟ chips) to sell the mechanic. EN strings
are provided in the logic class.

### Shared — Login  (FE-005/006/007/010 · BE-001/002/032)
Two steps. **(1) Pick:** search input + 2-col grid of player buttons (avatar initial + name).
**(2) PIN:** big avatar, name, "Add meg a 4 jegyű PIN-kódod", 4 dots, 3×4 numeric keypad
(digits + blank + 0 + ⌫). Biometric affordance line. **Prototype accepts any 4 digits** — wire
`auth:checkPlayerPin`; show wrong-PIN, loading, offline states. On success → player app.

### Concept B — Match-day hub "Meccsek" (home)  (FE-013/014/017/018/019/020)
- **Header:** eyebrow "MATCH-DAY HUB", title "Meccsek", right: points pill + avatar (→ Profil).
- **Daily progress strip:** conic-gradient ring (e.g. 3/4) + "Mai tippek" + remaining-count note.
- **ÉLŐ MOST:** broadcast dark live card — group/minute, pulsing red ÉLŐ, big `1 : 0`, three
  per-mode chips (🎯 your pred → live pts · 🪄 your pick → odds · ♟ round live).
- **MA · TIPPELHETŐ:** list of fused cards. Collapsed row = time · flags+names · **status chip**
  (`kész` green / `tipp` / `nincs tipp` amber) · caret. **Expanded panel** (3 sections divided by
  hairlines):
  1. 🎯 **EREDMÉNY-TIPP** (· 5/3/2/1 pont) — home name+flag, ± steppers around a 44px score tile,
     ":", away steppers, away name+flag.
  2. 🪄 **WIZARD** (· odds = pont) — 3 segmented buttons 1 / X / 2, each showing its decimal odds;
     selected = dark broadcast fill.
  3. ♟ **SVÁJCI** — one line: "A 4. fordulód része · párbaj **Zsolt** ellen" (read-only; Swiss is derived).
  - One full-width **save** button: "Mentés — eredmény + Wizard" → "✓ Mentve — mindkét játék".
- **BEFEJEZETT:** finished broadcast dark card with per-mode earned breakdown (🎯 +3 · 🪄 +2.40 · ♟ +3).

### Concept B — "Tabella" (unified standings)  (FE-011 · BE-013/022/023/029)
Segmented switch 🎯 Tippjáték / 🪄 Wizard / ♟ Svájci at top.
- **Tippjáték:** horizontal scope chips (🌐 Összes / 🏆 VB-teljes / 📊 Csoportkör / 🔥 Kiesés) +
  ranked rows (rank, avatar, name, pts, "n telitalálat" sub). Current player row highlighted (me-row).
- **Wizard:** info bar + rows (rank, name, accuracy %, pts to 2 decimals).
- **Svájci:** info bar + rows (rank, name, record "Gy-D-V", match points).

### Concept B — "Profil"  (FE-015/022/023 · BE-002/006/016)
Teal header card: avatar, name, "⭐ Kedvenc: Magyarország 🇭🇺", **per-mode rank tiles**
(🎯 2. · 🪄 5. · ♟ 2.). Settings list (icon · label · value · chevron): Kedvenc csapat,
Értesítések, PIN módosítása, Biometrikus belépés, Nyelv, Gyorsítótár ürítése. "Kijelentkezés".

### Concept B — Kieséses ágrajz / Brackets  (FE-021)
Two converging "March Madness" brackets in a horizontally-scrollable stage (auto-centers on the
final), current player / favourite highlighted, champion strip on top:
- **Párbaj rájátszás:** 5-round, 32-player single-elimination from the round-10 frozen Swiss seeding.
  Match score = the two players' round base points (0–40); higher advances; ties → higher seed.
- **VB kiesés:** 32-team knockout (Nyolcad→Negyed→Elő→Döntő), real Hungarian team names + emoji flags.
- **Vigaszág (helyosztó):** consolation/placement tree — QF losers play 5–8, SF losers the bronze.
  Full placement (1–32 / 5–32) is a documented extension.
- Card = two rows; winner teal+bold, loser muted; live final pulses. Connectors are absolutely-
  positioned segments from computed geometry (card 140×54, gap 34, pitch doubles per round) —
  recreate with an SVG/flex bracket lib or CSS grid in the target stack.
- **Still needed beyond the bracket:** group-stage tables (12 groups) + best-third matrix (FE-021).

### Admin console  (FE-025…036 — all backend-mapped in the inventory)
Desktop-first, calmer control-room palette, left sidebar (10 sections) / top scroll-strip on mobile.
Topbar: section eyebrow+title, "● ÉLES" env chip, admin identity + "FŐADMIN" role badge + logout.
Two cross-cutting patterns are **required**:
- **Confirmation modal** before every destructive/sensitive action (delete, clear result, override,
  bonus remove, reshuffle, manual poll, rollback, restore, clear log). Danger actions use red CTA.
- **Audit + recompute feedback:** every write appends to the transaction log, shows a toast
  "✓ … · naplózva", and (when it changes truth) shows a "Pontok és rangsorok újraszámolása…" banner.

Sections:
1. **Áttekintés (Dashboard)** — stat tiles (players/predictions/results 48/104/active round),
   system-status panel (version match v1.2.0 FE·BE·SW, poll freshness, cron, FE errors),
   "⟳ Pontok teljes újraszámítása", recent-audit feed. (FE-034, BE-013/015)
2. **Játékosok** — search + add; table (avatar, name, league, PIN badge, edit/delete). **Deleted
   players** panel with 30-day retention countdown + restore. (FE-026/027, BE-003/011/012)
3. **Eredmények & KO** — upsert warning; per-match ± score steppers + Mentés/Törlés; KO note
   (slots auto-derived, manual override flagged). (FE-029, BE-007/008/030)
4. **Felülírás** — player + match selects, new score, "Felülírás mentése · naplózva". (FE-030, BE-010)
5. **Bónuszok** — award form (player/points/reason) + recent-bonuses list with Visszavonás. (FE-031, BE-009)
6. **Svájci admin** — round status, suggested pairings list, Publish, Reshuffle (confirm),
   remove/restore player. (FE-033, BE-025)
7. **LiveScore** — API health / last poll / live / quota tiles; cache-freshness grid; **emergency-
   gated** manual poll (checkbox must be ticked, then confirm). (FE-028, BE-017/018/019)
8. **Napló** — CSV export + clear; transaction table (ts, type chip, text, who, **rollback** —
   enabled only for prediction txns). (FE-032, BE-014)
9. **Érdeklődők** — leads list (name/contact/message/date) with **mark-handled** toggle (fills the
   inventory gap — `leads:setHandled` had no UI). (FE-035, BE-026)
10. **Mentés & visszaállítás** — export JSON; **gated restore**: file → dry-run → diff (add/modify/
    remove summary) → confirm (auto restore-point). Replaces the raw one-click import. (FE-036, BE-028)

---

## Interactions & behavior

- **Navigation:** state-driven view switch (landing → login → app; app tab/section state). No page reloads.
- **Steppers:** ± adjust 0–20, clamp at bounds; editing marks the prediction unsaved; Save persists.
- **Wizard segments:** single-select 1/X/2; selected gets the dark broadcast fill.
- **Fused card (B):** one expanded at a time (accordion); caret rotates 180°; expand uses a
  transform-only slide.
- **Admin confirm flow:** action → modal (title/body/confirm label, danger styling) → on confirm
  run mutation + audit + toast (+ recompute banner ~2s). Backdrop click / Mégse cancels.
- **Toasts** auto-dismiss ~2.6s. **Emergency poll** button is disabled until the confirmation
  checkbox is ticked.
- **Required states to design/implement** (some only stubbed in prototypes): loading, empty,
  offline / stale-data ("utoljára frissítve…"), backend-unavailable, wrong-PIN, locked-match
  (after kickoff), saved/unsaved, recomputing, push-permission-denied, service-worker-update.

## State management

Prototype state (replace with backend + client store):
- **Session:** current player, auth status, language (HU/EN).
- **Player app:** active tab/section, scope filter, table mode (B), expanded fixture id (B),
  local `predictions` map (matchId → {home,away,saved}), local `wizardPicks` map (matchId → 1/X/2).
- **Admin:** active section, confirm payload, toast, recompute flag, emergency flag, restore step,
  and editable copies of players/results/bonuses/leads/log.

## Backend contract (Vercel + Neon; domain model fixed)

- **Stack:** Next.js on **Vercel**, data in **Neon (Postgres)** via the `apps/rewrite` Drizzle
  schema. The Convex deployment is being retired — keep the *shapes* it defined, move the storage.
- **Primary read:** the **`game:state`** payload shape (community-scoped; strips secrets) → seeds
  leaderboard/rankings, matches+results+apiCache, wizard, swiss, settings, favorites, bonuses.
  Serve it from a Next API route / server action over Neon (the existing `/api/state` proxy is the
  seam to repoint).
- **Writes grouped per interface** (typed API routes / server actions on Vercel, Neon-backed):
  auth (`/api/auth/player-pin`, PIN verify, kickoff lock server-side) · predictions · favorites ·
  results (`saveResult`/`clearResult`, merge-upsert only) · wizard (savePick, odds snapshot at
  submission) · swiss admin · notifications (push) · admin ops (settings, player lifecycle, txn
  log/rollback, deleted-restore, diagnostics) · health · import/export. Table classification
  (authoritative vs derived) + the recompute pipeline order are in `SPEC_DIGEST.md` (INV-03).
- **Rule of thumb:** never design/implement a screen that needs a backend function not in the
  inventory without marking it as new backend work.

## Open product decisions (resolve before/while wiring)

1. ~~Final stack~~ — **resolved: Vercel + Neon (Postgres).** Canonical post-login route still TBD
   (legacy redirects `/classic/index.html` — verify packaging).
2. EN: launch now, later, or hidden?
3. Are pre-kickoff predictions private, or visible via global state / player history? (If private,
   the `game:state` contract must change — define it first.)
4. Is Swiss/Parbaj automatic participation final? (If yes, drop obsolete profile controls.)
5. Should the Wizard join/profile remain a user choice?
6. Admin role tiers — which functions are founder-only vs delegated-admin?
7. Mandatory import/restore safeguards.

(Plus SPEC_DIGEST OQ-1…OQ-6 in the repo: favorite-eliminated switch, mirror-on-edit, EN status,
secret-stripping, server kickoff lock, Buchholz definition.)

---

## Gap analysis — info to layer into Concept B

Concept B's player screens are strong on the happy path but, measured against the game rules
(`SPEC_DIGEST.md`), the following are **missing** and should be added during implementation:

- **Predictions (fused card):** per-match kickoff **countdown + locked** state; **⭐ favourite ×2**
  badge on the favourite's matches; favourite **+3 qualification bonus** context; draw special-case
  hint (only 5/3 on a draw); test-match "always tippable" marker.
- **Tabella:** full tiebreak display (**pts → telitalálat → PPG**) incl. a PPG column; live **▲▼
  movement**; the **Teszt liga** scope + post-WC purge note; **private leagues** selector; bonus
  points only count in KO-inclusive scopes.
- **Wizard:** per-pick **leadáskori (frozen) odds** + **[1.10–10.0] clamp** indicator; **Varázslótanonc
  (mirror)** on/off + "picks auto-mirror from your predictions"; **missing-odds fallback** (peer →
  1.10 floor, `oddsSource`); pick **lock at kickoff**.
- **Svájci / Párbaj:** **tiebreakers** (match pts → pred pts → H2H → Buchholz); **bye = 3 pts**,
  **no-show 0–0**, **removal after 2 missed rounds**; **late-join through round 6**; **standings
  freeze after round 10** → seeding; round→match mapping. *(Playoff bracket now delivered.)*
- **Match centre:** **match-detail modal** (events / lineups tabs, odds ribbon); **"last updated /
  cache freshness"** + stale indicator; archive / full schedule.
- **Groups & knockout:** **group tables (12 groups)** + **best-third matrix** — absent from B; the
  brackets cover only the knockout. Build the group view.
- **Profile:** **favourite-switch window** state (free until first WC match · once until first KO ·
  locked after); deeper personal stats (PPG, best/worst round, exact hits); **notification categories**
  (kickoff / result / bonus) as separate toggles.
- **Cross-cutting states (mostly absent):** offline / **stale-data** banner ("utoljára frissítve" +
  retry); **recomputing**; **locked-match** visual; push-permission-denied; service-worker-update;
  empty / loading skeletons.

## Files in this bundle

| File | What it is |
|---|---|
| `Tomifoci 2026 — Concept B.dc.html` | **Primary** player app + landing (build this). |
| `Tomifoci 2026 — Brackets.dc.html` | Párbaj playoff + WC knockout brackets (consolation trees). |
| `Tomifoci 2026 — Admin.dc.html` | Admin operations console. |
| `REDESIGN_JOURNAL.md` | Per-screen FE/BE mapping + mock-data→`game:state` swap notes. |
| `functional-inventory.md` | Full FE-/BE- functional inventory, crosswalk, gaps, constraints. |
| `assets/logo.png`, `assets/favicon.svg` | Brand marks. |

**Also read in the repo** (`Cargosliptamas/Vb_Tippjatek_2026`): `BRAND_BOOK.md`,
`UI_STANDARDS.md`, `SPEC_DIGEST.md` (rules + invariants), `data.js` (teams/flags/schedule), and the
**`apps/rewrite/db/schema.ts`** (Neon/Drizzle data model) — with `convex/schema.ts` kept only as the
reference that documents the original domain shapes. These are the authoritative system + rules; this README distills them.

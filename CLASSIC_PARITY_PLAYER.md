# Classic → Rewrite — Player-Side Feature Parity Audit

> Audit date: 2026-06-28. Scope: **player-facing** features only (admin excluded except where it gates a player feature).
> Classic source: `/Users/tamasvarga/Documents/GitHub/Vb_Tippjatek_2026/` (vanilla JS + Convex/Neon).
> New app audited: `/Users/tamasvarga/Documents/GitHub/tomifoci.xyz/` (root Next.js rewrite).
> Status legend: ✅ present · 🟡 partial / cosmetically-present-but-broken · ❌ missing.

**Critical structural finding (sets the tone for the whole audit):** the spec-faithful pure engine in `lib/engine/{scoring,wizard,swiss,match-meta}.ts` is **dead code** — the only symbol imported from it anywhere is `isKickedOff` (in `lib/guard.ts:2`). The live read path is `api/state/route.ts` → `lib/db.ts` → `lib/client-state.ts`, which **reimplements only tip scoring** and serves the **Wizard and Swiss leaderboards from static snapshots migrated from Convex** — they never recompute. There is **no live data pipeline** (no cron/poll/recompute route, no `vercel.json`), so odds, live scores, events and lineups are never refreshed. Two of the "three games" are visually complete but functionally frozen.

---

## A. Navigation & shell

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Bottom-bar / sidebar nav | Up to 9 destinations: Ranglista, Tippjeim, Wizard, Párbaj, Meccs Center, Csoportok, Profilom, Névjegy, Admin (+ "Több" drawer on mobile) | 🟡 Only 3 items: Meccsek, Tabella, Profil (`player-nav.tsx`). Wizard/Swiss folded into Tabella tabs; Match-centre folded into Meccsek; no About/Admin in player nav | New screens needed for About; Wizard/Swiss are sub-tabs (acceptable consolidation) |
| `/brackets` route | n/a (bracket lives under Csoportok sub-nav) | 🟡 Route exists & renders but **no link anywhere** — unreachable from UI; content is fake (see Bracket section) | Wire a nav entry or remove |
| Header (logo, title, player badge) | Logo + "Tomifoci" + `#playerBadge` "Válassz játékost" → login modal | ✅ `page-header.tsx` present | — |
| Welcome / beta landing splash | `#wOverlay`: eyebrow, phone mockups, "app hamarosan", **interest lead form** (name/contact/message → `leads:submitInterest`), "Tovább/Kihagyom" | 🟡 Landing `page.tsx` exists with HU/EN copy toggle, but **no lead-capture form** | Add interest form + `leads` endpoint if desired |
| Login modal + player picker | `#playerOverlay`: filter input, player list, PIN row (4-digit), biometric row, logout link | ✅ `login/page.tsx` — player picker + PIN. ❌ no biometric (Face ID / Touch ID) row | Biometric WebAuthn unlock missing |
| Empty / loading placeholders | "Betöltés…", "Válassz játékost." per tab | ✅ present in screens | — |
| Toast system | `showToast` 2.5s `#toast` | ✅ used across save actions | — |
| Escape-to-close modals/drawer | Esc closes match/history/player/fav overlays + drawer | 🟡 modal close exists; not audited for full Esc-key coverage | minor |

---

## B. Authentication & session

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Player select + 4-digit PIN | Throttled `auth:checkPlayerPin`, returns `{ok,retryAfterMs}`; never auto-login on network error (anti-impersonation) | ✅ `api/auth/player-pin` claim-on-first-login | verify throttle parity |
| PIN cache / TTL | `vb26_vp_{name}`, PIN_TTL 3 days, TOTP_TTL 24h | 🟡 `lib/session.ts` session exists; TTL semantics not matched to classic | low impact |
| Face ID / Touch ID (biometric) | `bioSupported/bioRegister/bioUnlock` platform WebAuthn; setup buttons in login + profile | ❌ absent | new feature |
| Change PIN | Profile card: old/new/confirm, validation, `auth:setPlayerPin` hashed | ❌ Profile "PIN módosítása" row is **inert** (no onClick) | endpoint + handler |
| Logout | `logoutPlayer` clears PIN cache + player | ✅ works | — |

---

## C. Predictions — Tippjáték / Tippjeim

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Score stepper +/- | `predStepper`/`bump`, value clamped **0–20**, `:` separator, two inputs per match | ✅ `Stepper` clamped 0–20 (`match-card.tsx:39`); server re-clamps (`predictions/route.ts:37`) | — |
| Save behaviour | **Per-match auto-save** on change; reads both live inputs; toast "Tipp elmentve ✓" | 🟡 Saves via single **"Mentés"** button (prediction + wizard together), not per-field auto-save; functionally equivalent | minor UX diff |
| Point bands 5/3/2/1/0 | exact 5 · GD+winner 3 · winner+one-goals 2 · outcome 1 · wrong 0 (`calcPts`) | ✅ live path `client-state.ts:318` correct (engine `scoring.ts:19` correct but unused) | — |
| Draw special-case scoring | both-draw non-exact (2-2 vs 3-3) = 3; 2/1 bands don't apply to draws | ✅ handled in live `calcPts` | — |
| 90-minute-only result | regulation result scores; ET/pens ignored | ✅ scoring uses stored result; documented | — |
| Favourite ×2 doubling | raw×2 on matches favourite plays; `getActiveFav` stage logic; live deltas doubled | ✅ UI badge `⭐×2` + doubling in scoring (`client-state.ts:223`, `getActiveFav`) | — |
| +3 advance/qualification bonus | Auto **+3** per round favourite advances (server `bracket.ts::autoUpdateBracket`); shown in totals | ❌ **Not automatic.** Only manual admin bonus rows; "+3 bónusz" card text is explanatory only; **and the admin bonus endpoint doesn't exist (404)** | Needs bracket-driven bonus recompute |
| Kickoff lock | Client + server lock at `bpParse(m.date)`; locked card shows read-only `rbox` | ✅ `guard.ts:24 isKickedOff` (INV-10) + client `statusOf`; test ids never lock | — |
| Locked-card display | Full team names + read-only score, `.pend` if no result | ✅ broadcast/finished cards render tip + earned | — |
| Card ribbons (group badge, ⭐, countdown, venue) | group `gbadge`/test/KO tag, kickoff time, countdown pill, venue, ⭐ when fav plays | 🟡 cards show core info; not every chip (countdown pill, venue) confirmed | cosmetic gaps |
| Odds ribbon on upcoming card | `1/X/2` from `matchOdds` | 🟡 odds come from migrated `apiCache` only; usually `—` (no poll) | depends on live pipeline |
| Day-header grouping | `.day-hdr` by date; upcoming asc, past desc | 🟡 grouping present; ordering parity not fully verified | minor |
| "Eredményeim" collapsible past | `<details>` collapsed, responsive grid, count | 🟡 partial | — |
| Stats card (Összpont/Telitalálat/PPG/Tippelt) | 4 boxes from `playerTotals` | ✅ profile + tabella show pts/exact/PPG/predicted | — |
| Swiss matchup teaser on pred tab | `swMatchupCard` (join CTA / pairing / bye / live "Te N:N Ellenfél"), dismissible per round | 🟡 match-card has static "♟ SVÁJCI" text only, no live matchup | depends on Swiss recompute |
| "Daily meaningless stat" widget | `getDailyStat`/`fmtDailyStat` rotating daily at 6 AM | ❌ absent | nice-to-have |
| No-favourite reminder card | Gold CTA to set favourite | 🟡 favourite set via profile; no inline pred-tab reminder | minor |
| Cache-fix banner / button | `fixButtonPress` SW+cache wipe | ❌ no SW/cache to fix; not applicable | n/a (no PWA) |

---

## D. Wizard of ODDS — Smaragdváros Liga

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| League opt-in gating | Strict `profile.active`; CTA "🪄 Belépek…"; join backfills prior base preds as picks | 🟡 `wizardProfiles{active,mirror}` surfaced; pick UI always shown; **no backfill** | — |
| 1/X/2 pick UI | 3 buttons with live odds + Hazai/Döntetlen/Vendég labels; active = teal | ✅ picker in `match-card.tsx:133`; saved via `api/wizard` | — |
| Odds display | live odds per outcome (or `–`) | 🟡 from `apiCache`; almost always `—` (no poll) | needs live odds feed |
| Correct = odds, wrong = 0 | scored at pick-time odds | 🟡 logic exists in unused `wizard.ts`; **live path never scores wizard** | scoring frozen |
| Odds clamp [1.10, 10.00] | clamp on compute | ✅ applied on **save** (`wizard/route.ts:27`) | OK on write side |
| Odds repair chain (snapshot→cache→peer→1.10 floor) | `repairOdds` (WIZ-13) | ❌ `repairOdds` (`wizard.ts:39`) **never invoked**; null-odds picks stay `pending` forever | wire repair into recompute |
| Varázslótanonc / mirror mode | base prediction auto-converts to 1/X/2 (3-1→1, 1-1→X, 0-1→2), retroactive, overridable | ❌ `pickFromScore` (`wizard.ts:20`) unused; no mirror/derive logic in live path | missing |
| Mirror hints/suggestions on card | dashed-teal suggestion, override hints | ❌ absent | missing |
| Locked / settled pick display | "🔒 Lezárt tipp @ odds", hit `+odds pt` / miss `0 pt` / `kizárva` | 🟡 modal shows pick chip; no odds-at-pick scoring shown live | depends on scoring |
| Test-match exclusion | Wizard is WC-only (`stage==='test'` skipped) | 🟡 not verified; likely n/a | low |
| Wizard stats card (Odds pont, Helyes, Tippelt, Pontosság) | from `state.wizardRankings` | 🟡 renders, but from **static snapshot** — never moves | frozen |
| **Wizard leaderboard** | live rows from `wizardRankings` | 🟡 **Cosmetic** — `client-state.ts:60` returns migrated snapshot; new picks never recompute the board | needs `computeWizardScores` wired |
| Leave league | red "Kilépés a Ligából" with confirm | ❌ no in-app control (settings rows inert) | missing |

---

## E. Swiss / Párbaj

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| 13 rounds × 8 matches | round labels group/KO; `SW_ROUND_LABEL` | 🟡 `SWISS_ROUNDS`/`match-meta.ts` define it but **unused at runtime** | dead code |
| Auto-participation / enrolment | every player auto-in; join window through round 8 | 🟡 implied by snapshot; no runtime enrolment logic | — |
| Matchup score = Σ base pred pts (0–40, no fav doubling) | computed per pairing | 🟡 in `swiss.ts`, unused | dead code |
| Win 3 / draw 1-1 / loss 0 / bye 3 | match-point rules | 🟡 coded, unused | dead code |
| Tiebreak chain (MP → total pred pts → H2H → Buchholz avg, byes excluded) | full chain | 🟡 coded in `swiss.ts`, unused | dead code |
| Round-10 standings freeze | freeze logic | 🟡 coded, unused | dead code |
| Live provisional overlay (`● élő`) | running subtotal until round end | ❌ absent | missing |
| Pairings / matchup rows | `swMatchupRow` winner-highlight, bye/void/draw tags | 🟡 match-card "♟ SVÁJCI" is **static text only** | missing |
| **Standings table** (#, MP, Gy-D-V, Tipp, Bh) | live from `state.swiss` | 🟡 `SwissBoard` (`tabella:209`) renders W-D-L + MP from **static migrated snapshot** | frozen |
| Past-rounds archive + league events log | per-round toggles + 📣 Liga-események feed | ❌ absent | missing |
| Removed-player handling | strikethrough "kiesett", 2-missed-round removal | 🟡 only as far as snapshot carried | frozen |

---

## F. Leaderboard / Tabella

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Tip scopes (all / vb / group / ko / test) | chip bar `🌐 Összes · ⚽ Teszt · 🏆 VB · 📊 Csoportkör · 🔥 Kiesés`; persisted | ✅ `SCOPES` (`tabella:18`) all 5; live `rankings['${scope}_Mindenki']` | — |
| Test-league scope auto-hide | hidden after `testsPurged()` | 🟡 scope present; auto-hide-when-purged not verified | minor |
| Private / named leagues | logged-in sees own leagues; "Mindenki" default; private detection | 🟡 backend computes per-league (`huLeagues`) but **UI only requests `_Mindenki`** — private boards computed-but-unexposed | wire league selector |
| Podium top-3 (2-1-3 order, medals, count-up) | animated podium | 🟡 not confirmed present | cosmetic |
| Row meta (counted · exact · PPG · predicted/total) | full meta line | ✅ PPG column wired (`tabella:176`); meta present | — |
| **PPG column** | shown per row | ✅ present & wired | — |
| ▲▼ rank-movement indicators | **NOT implemented in classic either** (only podium, live 🔴 delta, expander arrows) | ❌ also missing in new app (`Rank` only prints `n.`) | parity = both absent; low priority |
| Live 🔴 delta (provisional, fav×2) | re-sorts rows while match live | 🟡 tip scoring is live but no explicit "🔴 +N élő" provisional row marker | minor |
| Top-10 + expander + "me ±1" neighbours | default 10, expand full, jump to current player | 🟡 "me" highlight works; expander/neighbour logic not confirmed | minor |
| Wizard board section | rows from `wizardRankings` | 🟡 cosmetic / static (see §D) | frozen |
| Párbaj board section | rows from `state.swiss.rows` | 🟡 cosmetic / static (see §E) | frozen |
| Logged-out CTA | "Csak nyilvános ranglista…" + Belépés | 🟡 public read works; specific CTA not confirmed | minor |
| Tie/sort (pts → exact → PPG) | server order + live tiebreak | ✅ live tip path sorts correctly | — |

---

## G. Profile — Profilom

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Header + 4 stat boxes | avatar, name, leagues, Összpont/Telitalálat/PPG/Tippelt | ✅ present (tip rank live; Wiz/Swiss ranks from static snapshot) | — |
| Favourite team card + picker | shows fav, pending/completed switch, round bonus; `openFavModal` | ✅ `FavoritePicker` → `api/favorites`; records team, flags `switched` | — |
| **Favourite switch-window rules** | 3-phase: free until 2026-06-11 21:00 → one switch until 2026-06-28 21:00 (KO-effective) → locked | ❌ **Not enforced** (`favorites/route.ts:8`: "enforced in a later pass") | port phase logic |
| Wizard participation toggles | "Részt veszek" + "Varázslótanonc" checkboxes → `saveWizardProfile` | ❌ profile settings rows are **inert** (no onClick) | handlers + endpoint |
| Párbaj status line | "Állásod: N. hely · MP …" | 🟡 SVÁJCI rank tile from static snapshot | frozen |
| 🔔 Notifications card + enable | `requestNotifications` permission flow + status text | ❌ "Értesítések" row inert; **no notifications system at all** | full feature |
| 🔄 Cache clear card | `fixButtonPress`/`forceUpdate` (unregister SW, wipe caches) | ❌ "Gyorsítótár ürítése" row inert; no SW to clear | n/a (no PWA) |
| Change PIN card | 3 inputs + validation → `auth:setPlayerPin` | ❌ "PIN módosítása" row inert | endpoint + handler |
| Face ID / Touch ID setup | biometric register | ❌ absent | missing |
| Language toggle (HU/EN) | path/community based (`/en`), no in-UI toggle | ❌ "Nyelv" row inert; login hardcodes `community:'hu'` → entire `en` backend path unreachable | missing |

---

## H. Match Centre — Meccs Center / Meccsek

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Live section (🔴 Élőben) | real live via `liveScores` or `inLiveWindow` (kickoff→+130m fallback); hero card w/ progress bar, elapsed, goal-flash | 🟡 LiveCard uses **time-window** status (`MATCH_WINDOW_MS` 2.5h, `derive.ts:7`), **no real live feed** | no poll/live data |
| "Élő adat átmenetileg nem elérhető" notice | shown when in-window but no data | ❌ absent | minor |
| Easter-egg simulated live matches (Hungary fantasy, commentary ticker) | 3 time-based fake live games + 🎙️ commentary, 30s ticker | ❌ absent | nice-to-have |
| Demo result cards | Hungarian fantasy demos with `showFrom` timing | ❌ absent | nice-to-have |
| Next-48h section | `mcUpcomingCard` 2-col grid, VS, countdown, odds | 🟡 upcoming matches render; not the exact 48h grouping | partial |
| Latest results (24h) / 24-72h / archive (>72h) | tiered result grids, collapsible archive | 🟡 finished cards render; tiered windows not replicated | partial |
| Full schedule toggle | day-grouped 3-col grid | 🟡 not confirmed | partial |
| Live tab badge (dot on nav) | `updateLiveTabBadge` | ❌ absent | minor |
| Cache-freshness indicator | "frissítve: {time}" reflecting real cache age | 🟡 "Élő adatok · frissítve X mp" shows **client fetch time**, not real data age (`game-provider.tsx:53`) | misleading |
| Manual refresh ⟳ | re-poll | ✅ ⟳ re-fetches `/api/state` | — |
| **Match detail modal** | ribbon, score breakdown (FT/ET/pens), odds, **Események tab** (goals/cards w/ pen `(B)`, own-goal `(ög)`, half separators), **Felállások tab** (XI, bench, sub arrows), refresh button | 🟡 modal has 2 tabs: "Összefoglaló" (tip/wiz/swiss) + "Odds" (usually `—`). **Events & lineups MISSING** — text says they appear "ha a LiveScore poll friss adatot ad" but no poll exists | events/lineups absent |

---

## I. Groups — Csoportok

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Sub-nav (Csoportállás / 3. helyezettek / Ágrajz) | 3 segmented tabs | 🟡 Csoport tab + bestThirds present; bracket separate/orphaned | — |
| Group standings tables | API standings or `calcGroup`; columns #, Csapat, M, Gy, D, V, Rg, Rk, GK, Pt; top-2 ✓; live tint | ✅ **fully implemented & live** — `lib/groups.ts groupTables` from results; top-2 green, 3rd orange (`tabella:63 GroupBoard`) | — |
| Live group tables | live-aware `calcGroup(gr,true)`, 🔴 ÉLŐ badge, "most játszik" dot | 🟡 computed from results; no live-match tinting (no live feed) | minor |
| API-source banner + refresh | "🌐 Hivatalos API állás" + ↻ | 🟡 n/a (no API source) | — |

---

## J. Third-place & Bracket

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Third-place ranking table | best 8 of 12 thirds advance; pts→gd→gf→name; ✓/cut row, ⚖️ tie flag | ✅ **group-stage best-thirds works** — `bestThirds` in `groups.ts`, top-8 ✓ in `GroupBoard` | — |
| Third-place qualification matrix (FIFA Annex C, 495 combos) | `THIRD_PLACE_MATRIX` maps which thirds fill which R32 slots | ❌ not implemented (only the ranking table, not the slot-assignment matrix) | missing |
| Knockout bracket view | `computeBracketState(results)`; R32→Döntő; phase gate; decided/maybe/placeholder sides; auto-fill from real results | ❌ **`bracket.tsx` is 100% hardcoded fake data** ("Tomi", "Zsolt", fictional scores); zero wiring to `results`/`koTeams`; **and unreachable from nav** | full rebuild + wiring |
| Bronze / 3rd-place match | id 103 in final round | ❌ part of fake bracket | missing |

---

## K. Player history, About, Changelog

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Player-history modal | click any player name → 3 tabs (Tippek/Wizard/Párbaj), read-only, fairness cutoff (only started matches) | ❌ absent — only the per-match modal exists; player names aren't clickable | full feature |
| About / Rules screen | `render-about.js`: scoring tables, draw special rules, favourite rules + dates, Wizard guide, Párbaj guide, SVG infographics, PWA install guide | ❌ no dedicated screen; rules text only inside orphaned `/brackets` page + inline card hints | new About screen |
| Changelog / version history | `CHANGELOG` array (v0.1→v1.3.17) rendered in About | ❌ absent | new feature |

---

## L. Notifications, offline, language, PWA

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Push notifications (web-push, VAPID) | `notify.js`: subscribe, server push, permission flow | ❌ **completely absent** — no SW, manifest, web-push, VAPID, `Notification`/`pushManager` anywhere | full feature |
| Kickoff alerts (30 min before) | SW `SCHEDULE_NOTIFICATION`, dedup by tag | ❌ absent | full feature |
| Result notifications (dedup per device) | `notifyNewResult` localStorage dedup | ❌ absent | full feature |
| Goal / red-card / HT / FT live notifications | per changelog v1.0.4 | ❌ absent | full feature |
| Offline mode / stale banner | localStorage snapshot restore + "⚠️ Offline mód" banner + reconnect toast | 🟡 partial — `game-provider` sets `status:'offline'`, Meccsek shows "Offline — utolsó állás" banner; **no real offline cache/SW** (reload while offline gets nothing) | needs SW/cache |
| Service worker / PWA install | `sw.js`, manifest, install guide | ❌ none | full feature |
| HU/EN language | path/community (`/en`) with `t()` + `locales/en.json` fallback; landing copy | 🟡 landing has HU/EN **copy toggle only**; in-app hardwired to `hu` (`login/page.tsx:42`), `en` backend path unreachable | wire community selection |
| Budapest-timezone pinning | all dates `Europe/Budapest` (+02:00) | 🟡 not verified; likely uses local/UTC | check parity |
| Daily-stat rotation | epoch-based daily index | ❌ absent | nice-to-have |

---

## M. Admin (gates player features — context only)

| Feature | Classic | New app status |
|---|---|---|
| Result entry | server mutation | ✅ `api/admin/result` works (INV-11 merge-upsert, ADMIN_TOKEN) |
| Players add/edit/delete, tip override, **bonus award/remove**, Swiss reshuffle/publish, manual poll, log rollback, backup restore | server mutations | ❌ **all 404** — only `api/admin/result` exists; the missing **bonus** endpoint is why the +3 advance bonus can't fire |

---

# Priority gaps (ranked by player impact)

Ranked by how badly a real player would feel the absence. ❌ = missing, 🟡 = present-but-broken.

1. **🟡 Wizard of ODDS leaderboard & scoring are frozen.** Picks save, but `computeWizardScores`/`repairOdds` are never invoked; the board is a static migrated snapshot. An entire game mode looks alive but doesn't score. (`client-state.ts:60`)
2. **🟡 Swiss / Párbaj is entirely static.** No runtime pairing, matchup scoring, bye=3, Buchholz, tiebreaks, or round-10 freeze — all coded in `swiss.ts` but dead. Standings frozen at migration. Second full game mode non-functional.
3. **❌ +3 advance bonus never fires automatically** — and the manual admin `bonus` endpoint returns 404. Favourite-driven scoring is incomplete; totals will be wrong once knockouts start.
4. **❌ Match-centre live data, events & lineups missing.** No poll/cron exists, so live scores are time-window guesses and the modal's Események/Felállások tabs are permanently empty. Odds buttons show `—`.
5. **❌ Favourite switch-window rules not enforced.** Free→once→locked phases ignored (`favorites/route.ts:8`); players can re-pick anytime, breaking fairness.
6. **❌ Notifications / push / PWA entirely absent.** No service worker, manifest, web-push, kickoff/result/goal alerts. A core engagement loop of the classic app is gone.
7. **❌ Knockout bracket is hardcoded fake data and unreachable.** `bracket.tsx` shows fictional players/scores, not wired to results; `/brackets` has no nav link.
8. **❌ Profile actions are inert decoration** — PIN change, notifications enable, language, cache clear, Wizard toggles have no handlers.
9. **❌ HU/EN language non-functional in-app.** Hardwired to `hu`; the whole `en` backend path is unreachable (landing toggle is cosmetic copy only).
10. **❌ About/Rules screen, changelog, and player-history modal all missing** — players can't read the scoring rules, see version history, or inspect another player's tips.

**Honorable mentions (lower impact):** private/named-league leaderboards are computed but never requested by the UI (only `_Mindenki`); cache-freshness chip shows client fetch time not real data age (misleading); no biometric login; no daily-stat / easter-egg / demo-match flavour; offline support is a banner without a real cache. Note: ▲▼ rank-movement arrows are **absent in both** apps, so that is parity, not a gap.

**What genuinely works end-to-end:** tip predictions (stepper, save, kickoff lock, favourite ×2, 5/3/2/1/0 incl. draw rules), the live tip leaderboard (scopes, PPG, me-highlight), group standings + best-thirds tables, the favourite picker (minus switch-window rules), login + PIN, and admin result entry.

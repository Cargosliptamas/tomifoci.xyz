# Classic → Rewrite — Player-Side Feature Parity Audit

> **Round 2 — re-audit date 2026-06-29.** Supersedes the Round-1 matrix (2026-06-28).
> Scope: **player-facing** features only (admin in `CLASSIC_PARITY_ADMIN.md`).
> Classic source: `/Users/tamasvarga/Documents/GitHub/Vb_Tippjatek_2026/` (vanilla JS + Convex).
> New app audited: `/Users/tamasvarga/Documents/GitHub/tomifoci.xyz/` (root Next.js rewrite, branch `rewrite`).
> Status legend: ✅ present (works) · 🟡 partial / present-but-reduced-or-misleading · ❌ missing.

**What changed since Round 1 (the headline):** the three "dead code / static snapshot" findings are **resolved**. `api/state` → `lib/db.ts:loadPublicStateFromNeon` → `lib/client-state.ts:buildPublicState` now runs the real engines on **every read**: Wizard (`computeLiveWizardRankings` → repairOdds → score → rank, with mirror gap-fill), Swiss (`computeLiveSwiss` → full pairing/score/tiebreak/freeze), and tip scoring. The knockout bracket is wired to real `koTeams` + `results` (no longer hardcoded). A **live pipeline exists**: `api/cron/poll` (every 15 min, `vercel.json`) → `lib/livescore.ts:runLiveScorePoll` writes pre-match **odds** and **FT results**; `api/match/[id]` → `fetchMatchCentre` returns real per-match **events + lineups**. PWA (`sw.js` + manifest), change-PIN, favourite switch-window enforcement, and a full Rules/Szabályok screen with changelog are all real now.

**The Round-2 story** is no longer "frozen games" — it is (a) **live in-progress scores are still not polled** (cards show `–:–` until FT), (b) a **wizard odds-repair field-shape bug** plus a never-written `kickoffOdds` snapshot, (c) **data computed but never rendered** (swiss pairings/log, private-league rankings), (d) a **dead push pipeline**, and (e) **no PIN throttle** (regression).

---

## A. Navigation & shell

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Bottom-bar / sidebar nav | Up to 9 destinations + "Több" drawer | 🟡 **5 items now** (Meccsek, Tabella, Wizard, Párbaj, Profil) — `player-nav.tsx:6-12`. Csoportok folded into Tabella, Match-centre into Meccsek; Szabályok & brackets not in nav | Add Szabályok/brackets entry if wanted (acceptable consolidation) |
| `/brackets` route | n/a (under Csoportok sub-nav) | 🟡 Route real & wired, but only linked from `parbaj/page.tsx:33` — not a nav item | Surface in nav |
| Header (logo, title, player badge) | Logo + title + player badge | ✅ `page-header.tsx` | — |
| Welcome / beta splash + **interest lead form** | `#wOverlay` with name/contact/message → `leads:submitInterest` | 🟡 Landing `page.tsx` with HU/EN copy toggle + card preview; **"Jelezz érdeklődést" is a dead `<Link href="/login">`** — no form/endpoint (`page.tsx:102`) | Add interest form + `leads` endpoint if desired |
| Login modal + player picker | Filter, list, 4-digit PIN, biometric row | ✅ `login/page.tsx` picker + search + PIN keypad. ❌ biometric row is **static label only** (`login/page.tsx:199`, no WebAuthn) | Implement or delete the biometric label |
| Empty / loading placeholders | "Betöltés…", "Válassz játékost." | ✅ skeleton + empty states (`meccsek/page.tsx:39,74`) | — |
| Toast system | `showToast` 2.5s | 🟡 player surfaces use **inline button states** (`match-card.tsx:178`), no toast; toast only in admin | minor UX diff |
| Escape-to-close modals/drawer | Esc closes overlays | ❌ no `keydown`/Escape handler; modal closes on backdrop/✕ only (`match-modal.tsx:67`) | minor |

---

## B. Authentication & session

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Player select + 4-digit PIN | Throttled `checkPlayerPin`, never auto-login on net error | ✅ `api/auth/player-pin` claim-on-first-login (`login/page.tsx:55-89`) | — |
| **Throttle / anti-impersonation** | `retryAfterMs` backoff on repeated failures | ❌ **Regression** — no attempt counter anywhere in `player-pin`/`change-pin`; unlimited guesses. Combined with claim-on-first-login, an unclaimed name's PIN can be set by anyone | Add rate limiting / lockout |
| PIN cache / TTL | `vb26_vp_{name}`, PIN_TTL 3 days | 🟡 `lib/session.ts` localStorage PIN reused on writes; no TTL/expiry | low impact |
| Face ID / Touch ID (biometric) | `bioRegister`/`bioUnlock` WebAuthn | ❌ absent (and falsely advertised, see A) | new feature |
| Change PIN | old/new/confirm → `setPlayerPin` | ✅ **now wired end-to-end** — `profil/page.tsx:231-322` → `api/auth/change-pin` → `changePlayerPinInNeon` | (no throttle on old-PIN check) |
| Logout | clears PIN cache + player | ✅ `clearSession()` (`profil/page.tsx:27-30`) | — |

---

## C. Predictions — Tippjáték / Tippjeim

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Score stepper +/- (clamp 0–20) | client + server clamp | ✅ `match-card.tsx:42`; server `predictions/route.ts:39` | — |
| Save behaviour | per-match auto-save on change | 🟡 single **"Mentés"** button saves prediction + wizard together (`match-card.tsx:54-67`) | minor UX diff |
| Point bands 5/3/2/1/0 | `calcPts` | ✅ live `client-state.ts:484-499`, byte-identical to classic | — |
| Draw special-case scoring | both-draw non-exact = 3 | ✅ handled in live `calcPts` | — |
| 90-minute-only result | regulation result | ✅ poll writes `ft_score` (`livescore.ts:138`) | — |
| Favourite ×2 doubling | raw×2 on fav matches, stage-aware | ✅ `client-state.ts:364-366,478` | — |
| +3 advance/qualification bonus | auto +3 per round fav advances | 🟡 **Data-driven now** — summed from the `bonuses` table into all/vb/ko scopes (`client-state.ts:325-329`); admin bonus endpoint **works** (was 404). But **not auto-computed** from bracket advancement; card "+3 bónusz" copy is static | Add bracket-driven auto-bonus if full parity wanted |
| Kickoff lock | client + server lock | ✅ `match-card.tsx:39` + `guard.ts:34 isKickedOff` (INV-10) | — |
| Locked-card display | read-only score | ✅ `match-card.tsx:110-178` | — |
| Card ribbons (group badge, ⭐, countdown, venue) | full chip set | 🟡 countdown + ⭐×2 present (`match-card.tsx:74-92`); **group badge & venue not shown** on collapsed card | cosmetic gaps |
| Odds ribbon on upcoming card | `1/X/2` from `matchOdds` | 🟡 odds shown only inside expanded Wizard section, not as the bottom odds-ribbon | cosmetic |
| Day-header grouping | `.day-hdr` per date | ❌ flat list, no per-day headers (`meccsek/page.tsx:55`) | minor |
| "Eredményeim" collapsible past | `<details>` grid | ❌ no per-player collapsible results list | — |
| Stats card (Összpont/Telitalálat/PPG/Tippelt) | 4 boxes | 🟡 profil shows pts·PPG·telitalálat (3, not 4-box) | minor |
| Swiss matchup teaser on pred tab | live opponent/score teaser, dismissible | 🟡 static "a kör 8 meccsének alappontja számít" text only (`match-card.tsx:157`), no live matchup | depends on rendering swiss pairings (data exists) |
| "Daily meaningless stat" widget | rotating daily at 6 AM | ❌ absent in player surfaces (data selected in `db.ts:172` but never rendered) | nice-to-have |
| No-favourite reminder card | gold inline CTA | ❌ no inline pred-tab reminder; profil shows "Kedvenc: nincs" only | minor |
| Cache-fix banner / button | `fixButtonPress` SW+cache wipe | 🟡 not on pred tab; cache clear lives in Profile now (PWA exists) | n/a inline |

---

## D. Wizard of ODDS — Smaragdváros Liga

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| League opt-in gating + backfill | strict `profile.active`; join backfills base preds | 🟡 `active`/`mirror` default **true**, admin-only; mirror gap-fill exists but **no player opt-in/backfill control** (`client-state.ts:127`) | add player toggle |
| 1/X/2 pick UI | 3 buttons + live odds + labels | ✅ `match-card.tsx:135-150` → `api/wizard` | — |
| Odds display | live odds per outcome | ✅ **now live** from `apiCache.odds` written by poll (`derive.ts:58`) | — |
| Correct = odds, wrong = 0 | scored at pick-time odds | ✅ **now LIVE** — `wizard.ts:130-134`, invoked at `client-state.ts:186` | — |
| Odds clamp [1.10, 10.00] | clamp on compute | ✅ on save (`api/wizard:28`) + engine (`wizard.ts:15`) | — |
| Odds repair chain (snapshot→cache→peer→1.10 floor) | `repairOdds` (WIZ-13) | 🟡 **engine correct but two of four sources dead**: (1) **field-shape bug** — `repairOdds` reads `{home,draw,away}` (`wizard.ts:31`) but poll/cache/UI use `{h,x,a}` (`livescore.ts:147`, `derive.ts:61`) → cache branch always yields 0; (2) `kickoffOdds` snapshot **never written in prod** (only in a test). Peer + 1.10 floor still work | fix odds key shape; write a kickoff-odds snapshot |
| Varázslótanonc / mirror mode | base pred auto-converts to 1/X/2 | ✅ **now works** — `pickFromScore` gap-fills mirror-on players (`client-state.ts:156-171`) | — |
| Mirror hints/suggestions on card | dashed-teal suggestion | ❌ no on-card suggestion hint | missing |
| Locked / settled pick display | "🔒 @ odds", hit `+odds pt` / miss `0 pt` / `kizárva` | 🟡 saved chip + live odds shown, but **no settled "+X.XX pt / kizárva" line** | add settled display |
| Test-match exclusion | WC-only (id≥999 skipped) | ✅ `wizard.ts:27-29,119`; `client-state.ts:167` | — |
| Wizard stats card | Odds pont / Helyes / Tippelt / Pontosság | ❌ `wizard/page.tsx` is leaderboard-only, no per-player stats card | add card |
| **Wizard leaderboard** | live rows from `wizardRankings` | ✅ **now LIVE** (was frozen) — `wizard/page.tsx:18` reads live-computed rankings | — |
| Leave league | red "Kilépés a Ligából" + confirm | ❌ no player-facing control | missing |

---

## E. Swiss / Párbaj

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| 13 rounds × 8 matches | `SW_ROUND_LABEL` | ✅ **now live** — `match-meta.ts SWISS_ROUNDS`, `swiss.ts:93` | — |
| Auto-participation / enrolment | every player auto-in; join window | 🟡 **admin-driven** enrol (`api/admin/swiss` joinedRound/removedAtRound); engine honours it (`swiss.ts:65`), but not classic "everyone auto-enrols round 1" | — |
| Matchup score = Σ base pred pts (0–40, no fav ×2) | per pairing | ✅ **now live** — `swiss.ts:27-37 basePtsFor` raw `calcPts` | — |
| Win 3 / draw 1-1 / loss 0 / bye 3 | match-point rules | ✅ `swiss.ts:109-128` (bye only when round complete) | — |
| Tiebreak chain (MP → pred pts → H2H → Buchholz avg, byes excl) | full chain | ✅ `swiss.ts:196-215,156-162` faithful | — |
| Round-10 standings freeze | freeze logic | ✅ `client-state.ts:250` `frozen` when R10 fully resulted | — |
| Live provisional overlay (`● élő`) | running subtotal | ❌ absent (`parbaj/page.tsx`/`standings-ui.tsx`) | missing |
| Pairings / matchup rows | winner-highlight, bye/void tags | ❌ **`state.swissPairings` computed but UI never renders it** (`parbaj/page.tsx` shows standings only) | render pairings (data exists) |
| **Standings table** (#, MP, Gy-D-V, Tipp, Bh) | live | ✅ **now LIVE** (was frozen) — `parbaj/page.tsx:30` → `SwissBoard` | — |
| Past-rounds archive + league events log | per-round toggles + 📣 feed | ❌ **`state.swissLog` populated but no UI consumer** (`client-state.ts:77`) | render archive/log |
| Removed-player handling | strikethrough "kiesett", 2-missed removal | 🟡 engine honours `removedAtRound` (admin-driven); no strikethrough UI | partial |

---

## F. Leaderboard / Tabella

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Tip scopes (all / vb / group / ko / test) | chip bar, persisted | ✅ live (`tabella/page.tsx:18-24`) | — |
| Test-league scope auto-hide | hidden after purge | ✅ **now done** — `testInAll` cutoff (`client-state.ts:415,428`) | — |
| Private / named leagues | per-league boards | 🟡 **computed but unexposed** — per-league rows built (`client-state.ts:444-449`) but UI hardcodes `${scope}_Mindenki` (`tabella/page.tsx:144`) | wire a league selector |
| Podium top-3 (medals, count-up) | animated podium | ❌ flat rows, no podium | cosmetic |
| Row meta (counted · exact · PPG · predicted) | full meta line | ✅ present | — |
| **PPG column** | per row | ✅ `tabella/page.tsx:173-176` | — |
| ▲▼ rank-movement indicators | **also absent in classic** | ❌ absent (parity) | low priority |
| Live 🔴 delta (provisional, fav×2) | re-sorts live | 🟡 tip scoring is live but no explicit "🔴 +N élő" marker | minor |
| Top-10 + expander + "me ±1" neighbours | default 10, expand, jump-to-me | 🟡 renders **all** rows (`tabella/page.tsx:167`), name-click → history; no expander/neighbour logic | minor |
| Wizard board section | rows from `wizardRankings` | 🟡 **live** but on a separate Wizard page, not within Tabella | consolidation choice |
| Párbaj board section | rows from `state.swiss` | 🟡 **live** but separate Párbaj page | consolidation choice |
| Logged-out CTA | "Csak nyilvános ranglista…" + Belépés | ❌ not present in tabella | minor |
| Tie/sort (pts → exact → PPG) | server + live tiebreak | ✅ `client-state.ts:466` | — |

---

## G. Profile — Profilom

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Header + 4 stat boxes | avatar, name, leagues, 4 boxes | 🟡 3 **rank** tiles (TIPP/WIZ/SVÁJCI) + 1 summary line, not the 4-box layout | minor |
| Favourite team card + picker | shows fav, pending/completed, bonus | ✅ `profil/page.tsx:57-155` → `api/favorites` | — |
| **Favourite switch-window rules** | free → one-switch (KO-effective) → locked, with the exact dates | ✅ **now ENFORCED server-side** — `api/favorites/route.ts:13-72` (`free`<2026-06-11 21:00, `once`<2026-06-28 21:00, then `locked`, `pendingKO`) | (was the #5 Round-1 gap) |
| Wizard participation toggles | "Részt veszek" + "Varázslótanonc" | ❌ **no UI card** (backend ready); worse, Rules screen claims "a Profilban kapcsolható" (`szabalyok/page.tsx:256`) — promises a missing control | add toggles |
| Párbaj status line | "Állásod: N. hely · MP …" | ❌ only a SVÁJCI rank tile; no record/standings line | add line |
| 🔔 Notifications card + enable | permission flow | 🟡 permission + subscribe work (`profil/page.tsx:325-391`) but **nothing ever sends a push** (dead pipeline, see L) | wire a sender |
| 🔄 Cache clear card | unregister SW, wipe caches | ✅ **now works** — clears CacheStorage + localStorage, keeps session (`profil/page.tsx:416-453`) | — |
| Change PIN card | 3 inputs + validation | ✅ **now works** (see B) | — |
| Face ID / Touch ID setup | biometric register | ❌ absent | missing |
| Language toggle (HU/EN) | path/community | 🟡 toggle flips **data community** (`profil/page.tsx:393-414`), not UI language — in-app strings stay Hungarian | real i18n still missing |

---

## H. Match Centre — Meccs Center / Meccsek

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Live section (🔴 Élőben) | real live via `liveScores`; hero card, progress, elapsed | 🟡 section renders but **time-window only** (kickoff→+2.5h, `derive.ts:37`); no real in-play feed | see next row |
| **Live in-progress score** | live score during match | ❌ **Regression / gap** — `runLiveScorePoll` polls only odds (`/fixtures`) + FT history (`/matches/history`), **never `/matches/live.json`**; no live-score field in state; `fetchMatchCentre` fetches `status`/elapsed but it's **returned and never rendered** → cards show `–:–` until FT | poll live scores; render them |
| "Élő adat átmenetileg nem elérhető" notice | shown when in-window, no data | ❌ absent | minor |
| Easter-egg simulated live matches (commentary ticker) | fake live games + 🎙️ | ❌ absent | nice-to-have |
| Demo result cards | Hungarian fantasy demos | ❌ absent | nice-to-have |
| Next-48h section | 2-col grid, countdown, odds | 🟡 open matches lumped into one "TIPPELHETŐ" list, no distinct 48h section | partial |
| Latest results tiers (24h / 24-72h / archive) | tiered grids, collapsible archive | 🟡 single "BEFEJEZETT" top-10, no tiers/archive | partial |
| Full schedule toggle | day-grouped 3-col grid | ❌ absent | partial |
| Live tab badge (dot on nav) | `updateLiveTabBadge` | ❌ absent | minor |
| Cache-freshness indicator | reflects real cache age | 🟡 **misleading** — shows time since client `/api/state` fetch (`game-provider.tsx:57`), not real LiveScore data age | read real `apiCache` age |
| Manual refresh ⟳ | re-poll | ✅ re-fetches `/api/state` | — |
| **Match detail modal** | ribbon, FT/ET/pens breakdown, odds, **Események** (goals/cards w/ pen `(B)`, own-goal `(ög)`, half separators), **Felállások** (XI, bench, sub arrows), refresh | 🟡 **major upgrade** — Events tab real (goals/cards/subs, pen + ög suffixes; **no half/ET separators**), Felállások real (**XI only — no bench, no sub-minute arrows**), Odds tab real. ❌ no FT/ET/pen score breakdown (poll never writes pen/HT/ET), ❌ no refresh button. Finished-match events are **ephemeral** (60s cache, not persisted — go blank once the match leaves the LS history feed) | add breakdown, bench/arrows, persistence |

---

## I. Groups — Csoportok

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Sub-nav (Csoportállás / 3. helyezettek / Ágrajz) | 3 segmented tabs | 🟡 Csoport + bestThirds present in Tabella; bracket linked from Párbaj | — |
| Group standings tables | columns #, Csapat, M, Gy, D, V, Rg, Rk, GK, Pt; top-2 ✓ | ✅ **live** — `groups.ts:7-47 groupTables`; top-2 green, 3rd orange | — |
| Live group tables | live-aware tint, 🔴 ÉLŐ | 🟡 position-based tint from results; no in-progress-match tint (no live feed) | minor |
| API-source banner + refresh | "🌐 Hivatalos API állás" | 🟡 n/a | — |

---

## J. Third-place & Bracket

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Third-place ranking table | best 8 of 12; ✓/cut | ✅ `groups.ts:50-55 bestThirds`, top-8 ✓ | — |
| Third-place qualification matrix (FIFA Annex C, 495 combos) | maps thirds → R32 slots | ❌ not ported (KO seeding comes from live `koTeams` poll instead) | missing |
| Knockout bracket view | `computeBracketState(results)`; R32→Döntő, auto-fill | ✅ **now wired to real data** (was hardcoded fake) — `bracket.tsx:99-140 buildWcSide` uses `koTeams`+`results`, winner-advance; highlights player's fav team | (was the #7 Round-1 gap) |
| Párbaj bracket | playoff bracket | 🟡 R0 seeded from frozen standings; later rounds placeholder-only (no playoff result feed yet) | — |
| Bronze / 3rd-place match | id 103 | ❌ bracket renders final (104) only, no slot 103 | missing |

---

## K. Player history, About, Changelog

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Player-history modal | click any name → 3 tabs (Tippek/Wizard/Párbaj), fairness cutoff | 🟡 **now exists & names are clickable** (`player-history-modal.tsx`, invoked from Tabella & standings) but **single Tippek-style view — no Wizard/Párbaj tabs** | add the two tabs |
| About / Rules screen | scoring tables, draw rules, favourite rules + dates, Wizard/Párbaj guides, PWA install guide | ✅ **now present & comprehensive** — `szabalyok/page.tsx` covers scoring, draw/ET, fav rules + exact dates, Wizard + odds-repair, Párbaj + tiebreak + freeze, bracket. 🟡 no PWA install guide | (was the #10 Round-1 gap) |
| Changelog / version history | `CHANGELOG` array | ✅ **now rendered** — `lib/changelog.ts` → `szabalyok/page.tsx:330-355` (fresh 8-entry list) | — |

---

## L. Notifications, offline, language, PWA

| Feature / element | Classic behaviour | New app status | Where / what's needed |
|---|---|---|---|
| Push notifications (web-push, VAPID) | subscribe + server push | 🟡 **subscribe path real** (`pwa-register.tsx:30-54` → `api/push/subscribe` stores subs; `lib/push.ts` real sender) but **`sendPush()` is never called** — subscriptions collected for nobody | wire a sender + VAPID env |
| Kickoff alerts (30 min before) | SW schedule, dedup | ❌ absent (`cron/poll` emits no notifications) | full feature |
| Result notifications (dedup) | `notifyNewResult` | ❌ absent | full feature |
| Goal / red-card / HT / FT live notifications | per changelog | ❌ absent | full feature |
| Offline mode / stale banner | snapshot restore + "⚠️ Offline mód" | 🟡 Meccsek header shows offline/freshness line (`game-provider.tsx:61`); no global stale banner | partial |
| Service worker / PWA install | `sw.js`, manifest, install | ✅ **now real** — `public/sw.js` (cache-first shell, network-first `/api/*`, push handler) registered by `pwa-register.tsx:63`; `manifest.webmanifest` linked in `layout.tsx` | (was the #6 Round-1 gap) |
| HU/EN language | path/community + `t()` | 🟡 landing copy bilingual; in-app Hungarian-only (community swaps data pool, not UI strings) | wire real i18n |
| Budapest-timezone pinning | all dates `Europe/Budapest` | ✅ **verified** — kickoff ISO carries `+02:00`; fav windows use 21:00 CET (`match-meta.ts`, `favorites/route.ts:13`) | — |
| Daily-stat rotation | epoch-based daily index | ❌ data selected (`db.ts:172`) but never rendered (orphaned read) | nice-to-have |

---

## M. Admin (gates player features — context only)

| Feature | Classic | New app status |
|---|---|---|
| Result entry, prediction override, bonus award/remove, swiss publish/reshuffle, diagnostics | server mutations | ✅ **now real** — `api/admin/{result,override,bonus,swiss,diagnostics}` implemented. See `CLASSIC_PARITY_ADMIN.md` for wiring caveats (txn-log source mismatch, backup restore no-op, manual-poll 404, KO penalties dropped) |

---

# Priority gaps (ranked by player impact)

Re-ranked for Round 2. The Round-1 top gaps (frozen Wizard/Swiss, fake bracket, missing PWA/Rules/change-PIN/fav-window) are **resolved**.

1. **❌ Live in-progress scores are never polled or rendered.** `runLiveScorePoll` does odds + FT history only — never `/matches/live.json`. Cards show `–:–` for the whole match, flipping to a score only when FT lands. `fetchMatchCentre` even fetches `status`/elapsed and throws it away. The single biggest remaining player-visible gap.
2. **🟡 Wizard odds-repair is partly broken (real bug).** `repairOdds` reads `{home,draw,away}` but the live cache/UI use `{h,x,a}` (`wizard.ts:31` vs `livescore.ts:147`/`derive.ts:61`), so the cache branch always yields 0; and the `kickoffOdds` snapshot is never written in prod. Mirror-derived picks degrade to peer-most-recent or the 1.10 floor instead of true market odds.
3. **🟡 Push pipeline is a dead end.** Subscriptions are collected but `sendPush()` is never invoked and the cron emits no notifications — enabling the 🔔 toggle does nothing. No kickoff/result/goal alerts at all.
4. **❌ No PIN throttle / anti-impersonation (regression).** `player-pin`/`change-pin` allow unlimited guesses; with claim-on-first-login, an unclaimed name's PIN can be set by anyone.
5. **❌ Swiss pairings, matchup rows, provisional overlay & league-events log not rendered.** `state.swissPairings` and `state.swissLog` are computed and in public state but no UI consumes them — Párbaj shows standings only, and the pred-tab matchup teaser is static text.
6. **❌ Wizard participation/mirror & leave-league controls missing** — backend is ready, but the Profile has no toggle, and the Rules screen falsely promises one.
7. **🟡 Private/named-league leaderboards computed but never requested** — UI only ever asks for `_Mindenki`; per-league boards exist but are unreachable.
8. **🟡 Match modal still incomplete** — no FT/ET/pen score breakdown (poll never writes pens/HT/ET), no lineup bench or sub-minute arrows, no half separators, no refresh; finished-match events are ephemeral (not persisted).
9. **❌ Biometric login advertised but absent** — `login/page.tsx:199` shows a "biometric available" label with zero WebAuthn behind it (misleading).
10. **🟡/❌ Cosmetic & flavour gaps** — player-history modal lost its Wizard/Párbaj tabs; no podium / top-10 expander / day-grouping / results-tiers; daily-stat orphaned; FIFA third-place matrix + bronze match missing; misleading cache-freshness chip; no toast / Escape-to-close.

**What genuinely works end-to-end now:** tip predictions + live tip leaderboard (scopes, PPG, test auto-hide); **live Wizard scoring & leaderboard**; **live Swiss scoring, standings, tiebreaks & round-10 freeze**; group standings + best-thirds; **real knockout bracket** wired to results; favourite picker **with enforced switch-window**; change-PIN; login + PIN; **Rules/Szabályok screen + changelog**; **PWA/service worker + manifest**; the live odds + FT-result cron and the match modal's real events/lineups/odds.

---

## Status tally (player)

| | ✅ | 🟡 | ❌ |
|---|---|---|---|
| Round 1 (approx) | ~17 | ~38 | ~33 |
| **Round 2** | **30** | **29** | **26** |

(Counts over the ~85 rows in sections A–L; M is context only. The shift is roughly +13 ✅, driven by live Wizard/Swiss/bracket, PWA, change-PIN, fav-window enforcement, Rules/changelog, and the live odds/FT/events pipeline.)

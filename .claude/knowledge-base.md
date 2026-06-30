# Knowledge Base — Classic Game Rules (parity reference)

> These are the **canonical game rules** of the classic VB Tippjáték, extracted from the
> original implementation in `Vb_Tippjatek_2026/` (the now-retired Convex+Cloudflare app).
> File paths below (e.g. `convex/wizard.ts`) refer to that legacy source — they document
> **where each rule came from**, not the live stack. The live game is this repo
> (`tomifoci.xyz`, Next.js + Neon + Vercel). Use this as the spec to verify parity of the
> Neon rewrite's engines (`lib/engine/*`). Mandatory constraints: the rules here are the
> source of truth for scoring, odds, Swiss pairing, locking, and notifications.

---

## 1. LiveScore Polling
**Legacy source:** `livescore.js`, `convex/livescore.ts`, `convex/crons.ts`, `convex/wcData.ts`

**Schedule:**
- Crons: `pollLive` every 1 min, `pollStandings` every 15 min.
- Adaptive cadence: **in-match window** (KO−35min → KO+200min) = full cadence; **outside window, in tournament** (Jun 6–Jul 19 2026) = ≤ once/hour; **outside tournament** = skip.

**API:** base `https://livescore-api.com/api-client`, WC2026 competition id `362`, auth via `?key=&secret=` params (Starter plan).

**Endpoints & shapes:**
1. **Live** (`/matches/live.json`): payload `data.match[]`/`data.matches[]`; fields `home_name|home.name`, `away_name|away.name`, `score|scores.score`, `status|state`, `time|elapsed|minute`, `id|match_id|fixture_id`. Output `{ [ourMatchId]: { h, a, elapsed, status, apiId } }`.
2. **History/results** (`/matches/history.json`): same shape. **Result gate** `resultAllowed()` = now ≥ kickoff+60min (blocks glitches/friendlies). Test/friendly ids ≥ 999 disqualified after WC start. Orientation-aware: flip h/a if API home ≠ our home. Output `{ matchId, h, a, apiId }`.
3. **Events** (`/matches/events.json?id=X`): `data.match` + `data.event[]`; fields `event|type` (uppercase), `player.name|player_name`, `info.name` (sub), `time|minute`, `sort`, `is_home|is_away` (**strings "1"/"0"** on real feed). Types: GOAL, GOAL_PENALTY, OWN_GOAL, YELLOW_CARD, RED_CARD, YELLOW_RED_CARD, SUBSTITUTION, MISSED_PENALTY. Score breakdown `{ht, ft, et, ps}`, orientation-corrected. ≤4 events refreshed per poll.
4. **Pre-match odds** (`/odds/pre-match.json?fixture_id=X`): market "1x2"/"match result"; selections 1/X/2 (`name|label|type`); values `odds|value|price` as float. **Shape `{ home, draw, away }` decimal odds**, null if unavailable. Orientation-aware swap.
5. **Standings** (`/groups/table.json?group_id=X`): group ids A–L = `{4286..4294, 4297, 4296, 4295}`; output `{ pos, played, w, d, l, gf, ga, gd, pts, name }[]`.
6. **Fixtures** (`/fixtures/matches.json?competition_id=362`): builds stable apiId → ourMatchId map (`apiMatchMap`).
7. **Lineups** (`/matches/lineups.json`): **disabled** (`FETCH_LINEUPS=false`, Starter plan).

**Caching:** raw payloads in `apiCache` table keyed by kind: `live`, `history`, `standings`, `odds`, `kickoffOdds`, `events_<id>`, `scores_<id>`, `lineup_<id>`, plus `pollMeta`/`pollDebug`/`eventsDebug`/`fixturesMeta`. Browser never calls the API directly — reads pre-parsed cache via `state`. Live scores auto-upsert results server-side (no admin PIN). Results trigger bracket + scoring + wizard + Swiss recompute.

**Team-name normalization:** English API → canonical English → Hungarian (e.g. "Korea Republic"/"South Korea" → "Dél-Korea"; "Czechia"/"Czech Republic"; "Türkiye"/"Turkey"; "Côte d'Ivoire"/"Ivory Coast"). Maps in `NAME_NORM` + `HU_TO_EN`.

**Single-flight:** `acquirePollLock`/`releasePollLock` prevents concurrent polls (OCC guard).

**Timezone:** KICKOFFS stored in Budapest local (CEST=UTC+2). All time checks use epoch ms (`Date.now()`); no conversion in backend.

---

## 2. Wizard of ODDS (1X2 odds league — "Smaragdváros Liga")
**Legacy source:** `convex/wizard.ts`, `convex/schema.ts` (wizardPicks, wizardScores, wizardProfiles, wizardRankings)

**Rules:** WC-only (ids ≥ 999 excluded). Points = decimal odds at pick time. Odds clamped **[1.10, 10.00]**. Pick ∈ {"1" home, "X" draw, "2" away}.

**Data model:**
- `wizardPicks`: `{ player, matchId, pick, oddsAtPick:number, oddsSource?:"snapshot"|"odds"|"peer"|"floor", lockedAt }`
- `wizardScores`: `{ player, pts, played, correct, byMatch?:{...} }`
- `wizardProfiles`: `{ player, active, mirror }` (absent = default active+mirror)
- `wizardRankings`: `{ ts, rows:[{name, pts, played, correct, accuracy}] }`

**Pick locking:** at kickoff (`isKickedOff(matchId, now)`); test ids no-op.

**Odds lookup chain (at pick time):**
1. Frozen kickoff snapshot (`kickoffOdds` apiCache), set via `snapshotKickoffOdds()` — idempotent, never overwrites.
2. Live odds cache (`odds`).
3. **Peer fallback** [v1.2.1]: most-recent other player's `oddsAtPick` for same match+pick (highest `lockedAt`).
4. **Floor 1.10**: only if a result exists and none above (never pre-kickoff).

**Odds repair at scoring** [v1.2.0]: any pick with `oddsAtPick=0` repaired via same chain; `oddsSource` persisted. Still 0 at result time → **disqualified (0 pts)**.

**Toggles:** `active=false` → opted out (mutations no-op). `mirror=true` → derive picks from predictions (h>a→"1", h=a→"X", h<a→"2"); enabling backfills all existing predictions incl. finished; new predictions auto-mirror. Default (no row) = active+mirror.

**Scoring:** correct = pick matches outcome; pts = oddsAtPick (clamped); accuracy = correct/played.

---

## 3. Swiss / Párbaj head-to-head
**Legacy source:** `convex/swiss.ts`, `convex/schema.ts` (swissProfiles, swissPairings, swissStandings, swissLog), `data.js` (SWISS_ROUNDS)

**Structure:** 104 WC matches → **13 rounds × 8 matches** (by kickoff order). R1–8 group stage; R9–13 single-elim playoffs + consolation Swiss. **HU-only** (EN excluded).

**Player lifecycle:** all registered auto-enrolled at launch (joinedRound=1). Late join allowed until R9's first kickoff. No-show: 2 consecutive completed rounds with 0/8 predictions + a pairing → flagged; admin confirms removal → past matchups become opponent byes (3 pts).

**Scoring per matchup:** base = Σ of 8 `calcPts(pred,res)` (no fav ×2, no bonuses). Match points: **win 3 / draw 1 / loss 0 / bye 3**. Both sides 0 predictions → void.

**Tiebreakers (per poll):** 1) match points; 2) base points (completed group rounds); 3) H2H (only if exactly 2 tied + decisive mutual result); 4) name (HU alphabetical). Buchholz computed for **display only**.

**Pairing:** R1–2 random + bye (lowest-ranked, fewest byes); R3–8 Swiss by standings, rematch-avoidance + fallback; R9–13 top-32 single-elim (fixed seed order; draws → higher seed advances) + consolation Swiss (ranks 33+). R9=16 matches, R10=8, R11=4, R12=2, R13=1 (3rd place).

**Storage:** `swissProfiles` (who plays), `swissPairings` (matchups: round,a,b,tier,slot,publishedBy), `swissStandings` (derived snapshot), `swissLog` (audit). Predictions+results immutable; pairings+profiles stored; rest recomputed.

**Publishing:** before round's first kickoff (manual or auto-fallback at KO−4h, `autoPublishDue()`). Admin can reshuffle (re-pairs, logs, recomputes).

**Engine:** pure `evaluate()` (profiles+pairings+predictions+results → standings+breakdown, no DB). Rule hook `defaultReshuffleRule()`. Validation: each eligible player exactly once, no self-pairs, known names.

---

## 4. Scoring
**Legacy source:** `convex/scoring.ts`, `js/scoring.js`, `data.js` (MATCH_META)

**Formula (`calcPts`):**
```js
if (pred.h===res.h && pred.a===res.a) return 5;       // exact
const pd=pred.h-pred.a, rd=res.h-res.a;
const po=sign(pd), ro=sign(rd);
if (po===0 && ro===0) return 3;                        // both draw
if (po!==ro) return 0;                                 // wrong outcome
if (pd===rd) return 3;                                 // exact goal difference
if (pred.h===res.h || pred.a===res.a) return 2;        // one team's goals right
return 1;                                              // outcome only
```
Only 90-min result counts (penalties `pen_h`/`pen_a` stored but **not** scored).

**MATCH_META:** stage ∈ group(1–72)|ko(73–104)|test(≥999). KO names populated from `koTeams` at runtime.

**Scope filtering:** `all` (group+ko+test before TEST_PURGE_TS=2026-06-11 16:00 BP), `vb` (group+ko), `group`, `ko`, `test`. After TEST_PURGE_TS test matches drop from `all`.

**Favourite-team bonus:** active favourite (`getActiveFav(fav,stage)`) = **×2** on match points. Phase-aware: pre-WC = original; group = original if switched+pendingKO else switched; ko = new (if switched); default = original.

**Advance bonus:** +3 per round for initial/switched favourite team.

**Server scores:** `playerScores` per player/community: `pts, matchPts, bonus, exact, counted, predicted, totalR, ppg, byScope, byMatch?`. Recomputed every poll. Client does **no** point math.

---

## 5. PIN Auth & Throttle
**Legacy source:** `convex/auth.ts`, `convex/game.ts`, `convex/schema.ts` (pinHashes, adminAuth, authAttempts)

**Storage:** salted **SHA-256** only (16-char hex salt = 8 random bytes); hash = `sha256(salt+":"+pin)`. `pinHashes.by_name` for players; single `adminAuth` row for admin.

**Player check** (`checkPlayerPin`): args `{player,pin,community?}` → `{ok, retryAfterMs}`. **No PIN set → open access** (ok=true). Wrapped in `throttledCheck()`.

**Admin check** (`checkAdminPin`): args `{pin}` → `{ok, retryAfterMs}`. **No admin row → reject** (fail-closed [H5]).

**Throttle [C3]:** 4 free mistakes, then escalating: 5–9 fails = 5s; 10–19 = 30s; 20+ = 60s cap. **Quiet window** 15min resets counter. Correct PIN clears record. Keys: `"player:<community>:<name>"`, `"admin"`.

**Server gates:** `assertPlayerPin(ctx,player,community,pin)` / `assertAdmin(ctx,pin)` before any DB write. No-PIN players still open.

**PIN changes:** `setPlayerPin()` requires admin; `setAdminPin()` requires current admin; `seedAdmin()` internal one-time bootstrap (fails if admin exists).

---

## 6. Push Notifications
**Legacy source:** `convex/push.ts`, `js/notify.js`, `sw.js`, `convex/crons.ts`

**VAPID:** public key in client; private = Convex env `VAPID_PRIVATE`; email `mailto:vargatamas84@gmail.com`. Subscriptions in `pushSubscriptions` `{endpoint, sub}`. Broadcast queries table → `webpush.sendNotification()`; prune on 404/410, log other errors.

**Types & triggers:**
1. **Kickoff** ⏰ — 30min before KO, once per match (`notifyState.kick`). Tag `kick-{id}`.
2. **Half-time** ⏸ — when live `time|status` = HT, once (`notifyState.ht`). Tag `ht-{id}`.
3. **Goal** ⚽ — new events (≤4/poll), gate event count > cached. Tag `goal-{id}-{time}`.
4. **Red card** 🟥 — same as goals. Tag `red-{id}-{time}`.
5. **Result** 🏁/🔄 — on `saveResult()`. Tag `result-{id}`.
6. **Daily stat** ⚡ — cron 08:00 UTC (10:00 BP), rotates `dailyStats` (epoch 2026-06-06 06:00 BP, advance daily 6AM). Tag `dailystat-{idx}`.
7. **Bonus** ⭐ — on `awardBonus()`. Tag `bonus-{player}`.

App URL `https://tomifoci.xyz/`; icon/badge `logo.png`; vibration `[200,100,200]`. Client logs result notifications in `localStorage` `vb26_notified_results` (signature `"{h}:{a}"`) for device-local dedupe.

---

## 7. Match Metadata & Locking
**Legacy source:** `convex/wcData.ts`, `data.js`, `convex/scoring.ts`, `convex/game.ts`

**Kickoffs:** `KICKOFFS: Record<number,string>` in `convex/wcData.ts`, **Budapest local (ISO8601 +02:00)**. 104 matches (1–72 group, 73–104 KO). Test ids ≥ 999: no entry → never locked.

**Prediction lock:** `isKickedOff(matchId, now)` = now ≥ KO. Unknown ids → false. `savePrediction()` throws if locked; `savePick()` no-ops if locked. Client clock mirrors server; faked clock bypassed by direct mutation gate.

**KO bracket:** group results (top 2/group) → `autoUpdateBracket()` writes `koTeams` (matchId, home, away, confirmed?, auto?, autoNote?). `confirmed=true` = admin-locked (no auto-overwrite). Fav bonuses recomputed after.

**Group standings tiebreak:** points → GD → GF → name (HU). Live standings fold in-progress matches if `includeLive=true` (marked `live=true`).

**Result acceptance:** earliest KO+60min (`resultAllowed()`).

---

## Ambiguities / gaps flagged during extraction
1. `oddsSource` field — persisted to `wizardPicks` but final-flow documentation thin.
2. Live score reversal relies on name-matching; double-misname collision could fail silently.
3. Consolation Swiss slot naming (R9–13) ("R32-1", "SF2") → playoff-round mapping unclear from comments.
4. Buchholz computed/stored but display-only; ranking uses mp → base → H2H → name.
5. Event `sort` field captured but not required; falls back to array index.
6. Friendly comp ids 371 vs 1 rationale unclear; both disabled after WC start.
7. No-show flag persists until admin confirms; no auto-removal.
8. Kickoff-odds snapshot timing vs odds-feed lag not formally specified.

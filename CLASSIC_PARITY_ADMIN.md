# Classic ↔ Rewrite — Admin Feature-Parity Audit

> **Round 2 — re-audit date 2026-06-29.** Supersedes the Round-1 matrix (2026-06-28).
> Scope: ADMIN console only. Classic source = `Vb_Tippjatek_2026/js/admin-*.js`, `js/game-actions.js`, `SPEC_DIGEST.md`.
> New app = `tomifoci.xyz/app/admin/page.tsx` + `app/api/**`.
> Status legend: ✅ present (works) · 🟡 partial (UI exists but backend missing/reduced, or real backend mis-wired) · ❌ missing.

**What changed since Round 1 (the headline):** Round 1's "only `/api/admin/result` exists" is **obsolete**. There are now **8 admin routes** — `result, players, override, bonus, swiss, log, backup, diagnostics` — plus `cron/poll`. Most route bodies are **genuinely implemented against Neon** and log to `txnlog`. The Round-2 problem is **wiring**, not absence:

- **Fully real AND correctly wired (4):** `result` (minus penalties/logging), `override`, `bonus`, `diagnostics`.
- **Real backend, partially/incorrectly wired (3):** `players` (only create+delete of 4 actions reach the UI), `swiss` (only publish+reshuffle of 4), `log` (read/rollback/clear all real but the **UI points at the wrong table** → rollback broken).
- **Real backend, effectively unreachable from UI (1):** `backup` (restore sends only a filename, never file contents → no-op; the route's own export action is bypassed).
- **UI button with no backing route (1):** manual poll → `/api/admin/poll` (404).

Auth model still differs: classic uses an admin **PIN** + optional **TOTP**; new admin uses a single **`ADMIN_TOKEN`** header, validated only when a write fires.

---

## 1. Login & Authentication

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Admin login | PIN → `POST /api/auth/admin-pin`, `{ok, retryAfterMs}` | 🟡 `ADMIN_TOKEN` typed in; `setAuthed(true)` is **client-only** (`page.tsx:157`), no server verify until a write fires; per-route `x-admin-token` check (`lib/admin.ts:8-24`) | No dedicated login route; token checked per write | Add a verify endpoint or keep token model |
| PIN rate limiting | `retryAfterMs` backoff | ❌ none (token equality only) | — | Add lockout to admin auth |
| TOTP 2FA setup/test/disable | `setup2fa`/`confirm2fa`/`test2fa`/`disable2fa` (RFC 6238) | ❌ missing entirely | — | Port `admin-totp.js`; `adminTotp` already redacted from state (`backup/route.ts:60`) but no feature |
| 2FA login gate | `ADMIN_2FA_ENABLED` flag | ❌ missing | — | Carry dormant flag |
| Face ID / Touch ID | `setupAdminBio`/`unlockAdminBio` | ❌ missing | — | Port if wanted |
| Logout | n/a (PIN persisted) | ✅ `⏏` resets token/section (`page.tsx:214`) | n/a | — |

---

## 2. Dashboard / Overview

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Stat tiles (players/preds/results/round) | stats in Version card | ✅ tiles from `/api/state` (`page.tsx:287-301`) | `/api/state` ✅ | — |
| System status panel | n/a | ✅ DB / scoring / swiss-round (`page.tsx:303-317`) | read-only | — |
| Recent log (dashboard) | n/a | 🔴 reads **`state.swissLog`** (legacy Swiss table), not the real admin `txnlog` (`page.tsx:292`) | read-only | Point at `state._txnlog` (already in state) |

---

## 3. Recompute / Repair pipeline (INV-03)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Full recompute | `runRepairScores` → 6-step recompute | 🟡 "Pontok újraszámítása" just re-reads state (`page.tsx:308`); state derived live on read | ❌ no recompute route | OK if derive-on-read is trusted; else add explicit trigger |
| Recompute-after-mutation (INV-03) | server fires 6-step pipeline | 🟡 derived live in `loadPublicStateFromNeon` on read; write routes upsert truth only | partial | Verify all derived reads reflect writes |
| Name consolidation / merge | `runConsolidateName` (re-stitch q_-encoded names) | ❌ missing (diagnostics only **detects** encoded names, `diagnostics/route.ts:66-78`) | — | Add consolidation tool |

---

## 4. Leagues management

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Add / rename(remap) / delete league, private toggle | `addLeagueRow`, `saveAdminSettings`, `.lprv` | ❌ no league editor; players show `leagues?.[0]` read-only (`page.tsx:385`) | ❌ | Add league editor + settings write |

---

## 5. Player lifecycle

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Add player | `addPlayerQuick` (name+PIN+leagues) | ✅ "+ Új játékos" → `players` `create` (`page.tsx:358`, route `:68-88`); server auto-names; **no name/PIN/leagues input**; logged | ✅ `players` | Add input form |
| Edit player name (cascade INV-02) | inline → `renamePlayer` cascade | 🟡 **route real & full** (`players/route.ts:90-156`) but **UI ✏️ button is still a `showToast('Backend még nincs bekötve')` stub** (`page.tsx:388`) | ✅ route, ❌ wiring | Wire the ✏️ button to the route |
| Edit league membership | `.plg` checkboxes | ❌ missing | — | Add membership editor |
| Set/change player PIN | `.ppin` → `setPlayerPin` | ❌ no admin "set this player's PIN" (only player self-serve via `api/auth/*`) | ❌ | Add player-PIN endpoint |
| Set new admin PIN | `newPinInp` → `setAdminPin` | ❌ missing | ❌ | Add admin-PIN change |
| Delete player (cascade) | type-name confirm → cascade, **10-day** restore | ✅ `players` `delete` — real cascade (preds + name-keyed tables + swiss bye + roster + snapshot archive), logged (`page.tsx:400`, route `:169-218`). 🔴 **UI copy says "30 napig"** but route constant is `TEN_DAYS_MS` (`route.ts:26`) — **10 vs 30 mismatch** | ✅ `players` | Reconcile 10 vs 30-day text |
| Restore deleted player | `restoreDeletedPlayer`, shows `daysLeft` | 🟡 **route real** (`players/route.ts:239-290`) but **UI never calls it** (no restore button) | ✅ route, ❌ wiring | Add restore button |
| Deleted-players list | `loadDeletedPlayers` | 🟡 data exists (`deletedPlayers` table) but **UI hardcodes "Nincs törölt játékos."** (`page.tsx:416`); no list endpoint | ❌ list | Add list endpoint + binding |

---

## 6. Results (truth writes)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Save result (90-min) | `saveResult` merge-upsert (INV-11) | ✅ `Mentés` → `/api/admin/result` `ON CONFLICT DO UPDATE` (`page.tsx:476`, route `:48-52`) | ✅ `result` | — |
| Clear result | `clearResult` | ✅ `Törlés` → `result` `clear` (DELETE by match_id) | ✅ | — |
| KO penalties (pen_h/pen_a) | `rph`/`rpa` for `stage==='ko'` | 🔴 **dropped** — result route accepts only `{matchId,h,a}` (`route.ts:24`), no UI inputs (`page.tsx:489-518`). Schema + `backup` restore them, but the results admin ignores them → KO scoring truth gap | ❌ | Add pen fields to UI + route |
| Recompute on save | server recompute fires | 🟡 implicit on read | partial | — |
| Result write logging | classic logs | 🔴 **result route does not import `logTxn`** — result save/clear never appears in the txn log (every other write logs) | — | Add `logTxn` to result route |

---

## 7. KO / bracket team management

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Auto-derived KO slots | `koTeams` auto badges | 🟡 static info note only (`page.tsx:449`) | — | Surface auto slots/state |
| Manual KO override | `koh`/`koa` → `saveKoTeams` | ❌ no editor | ❌ | Add override endpoint + UI |
| Confirm/lock auto pairing | `confirmKoTeams` | ❌ missing | ❌ | Add confirm endpoint |

---

## 8. Prediction override (admin)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Manual prediction override | `adminSetPrediction` (bypass lock INV-10, re-mirror, log) | ✅ **fully wired** — `page.tsx:578` → `/api/admin/override` merge-upsert bypassing kickoff lock, captures `before`, logs txn; wizard mirror re-derives on read (`override/route.ts:48-61`) | ✅ `override` | — |

---

## 9. Bonuses

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Award bonus | preset `+3` per round → `awardBonus` | ✅ free-form pts + reason → `/api/admin/bonus` `award`, logged (`page.tsx:648`, route `:64-85`) | ✅ `bonus` | preset round buttons optional |
| Revoke bonus | `removeBonus` (last) | ✅ per-entry `Visszavonás` → `bonus` `remove` by index (`page.tsx:682`, route `:40-61`) | ✅ | — |
| Bonus list | per-player last-5 + total | ✅ rendered from `state.bonuses` (`page.tsx:603`) | read | — |

---

## 10. Swiss / Párbaj admin

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Start league + draw R1–2 | `startSwissLeague` (auto-include, late-join) | ❌ missing | ❌ | Add start-league endpoint |
| Suggest pairings (preview) | `suggestSwissPairings` | ❌ no suggest query | ❌ | Add preview endpoint |
| Publish pairings | `publishSwissPairings` | ✅ `swiss` `publish` (draws if none exist) (`page.tsx:751`, route `:89-111`) | ✅ `swiss` | — |
| Reshuffle rounds | `reshuffleSwissRounds` — multi-round + note | 🟡 `swiss` `reshuffle` **single round, random re-pairing (not the seeded engine)**, no note (`page.tsx:720`, route `:113-122`) | ✅ (reduced) | Add multi-round + note + seeded pairing |
| Add player to league | covered by start-league late-join | 🟡 **route real** (`swiss/route.ts:124-143`) but **UI never calls it** | ✅ route, ❌ wiring | Add button |
| Remove player (no-show) | `swissRemove`/`RemoveAllRecommended` (2× missed → flagged) | 🟡 **route real** (sets `removedAtRound`, `swiss/route.ts:145-155`) but **UI never calls it**; no flagged list | ✅ route, ❌ wiring | Add removal UI + flagged surfacing |
| Restore removed player | `restoreSwissPlayer` | ❌ missing | ❌ | Add restore endpoint |
| Removed-players list | from `swissProfiles` | ❌ missing | — | Surface removed list |
| Swiss log | per-action audit | 🟡 shown via `state.swissLog`, not in Swiss section | read | — |
| Standings freeze (after R10) | engine freezes | 🟡 status text "10. forduló után fagy be" (`page.tsx:710`); no control | read | informational |

---

## 11. LiveScore / API integration

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| API key/secret settings | `saveLsSettings` (INV-09) | ❌ no key/secret inputs | ❌ | Add admin-gated API-config write |
| Auto-sync toggle | `lsAutoSync` | ❌ missing | ❌ | Add toggle |
| Manual API unlock modal | red confirm → `_manualApiEnabled` | 🟡 emergency checkbox + confirm in ApiSection | — | — |
| Manual: fetch results / poll | `adminSyncResults` | 🔴 **UI `write('poll',…)` calls `/api/admin/poll` → 404** (only `cron/poll` exists) (`page.tsx:835`); always "Backend még nincs bekötve" | ❌ no `admin/poll` route | Add `admin/poll` route (or point UI at cron) |
| Manual: standings / live / fixtures+odds | `refreshApiStandings` / `refreshLiveScores` / `refreshFixturesAndOdds` | ❌ folded away / missing | ❌ | Add if emergency controls wanted |
| Friendly API test | `runFriendlyApiTest` | ❌ missing | ❌ | optional |
| Cache freshness view | n/a | ✅ tiles + per-key freshness from `state.apiCache` (`page.tsx:776-811`) | read | — |
| Auto poll (cron) | server cron | ✅ `app/api/cron/poll/route.ts` (every 15 min, `vercel.json`) | ✅ | — |

---

## 12. Transaction log & rollback

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| View log | `renderTxnLogCard` — last 20 from `_txnlog` | 🔴 **wrong source** — route `read` queries `txnlog` (`log/route.ts:44-56`) but the Log/Dashboard UI render **`state.swissLog`** (`page.tsx:865`); the real log is in `state._txnlog` (`client-state.ts:60`) and **unused** → admin actions never appear in the admin log | ✅ route, 🔴 wiring | Render `state._txnlog`, drop `swissLog` |
| Rollback entry | `rollbackTxn` (restore pre-state) | 🔴 **broken end-to-end** — route real for prediction txns keyed by ts in `txnlog` (`:69-105`), but UI feeds it `swissLog` timestamps → `txn-not-found`; UI still says "a backend bekötése után lép életbe" (`page.tsx:937`) | ✅ route, 🔴 wiring | Feed `_txnlog` ts |
| Rollback eligibility | server decides | ❌ not surfaced | — | Surface per-entry |
| Clear log | `clearTxnLog` | 🟡 route real (archives to `txnlogArchive`, `:107-122`) but clears `txnlog` while UI shows `swissLog` → list won't visibly empty | ✅ route, 🟡 wiring | Same source fix |
| CSV archive export | `downloadTxnArchive` (full archive) | 🟡 client-side CSV from **`swissLog`** (wrong/legacy log) (`page.tsx:867`) | — | Export real `txnlog`/archive |

---

## 13. Frontend error log

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| JS error capture/view | `window.onerror` → localStorage → `renderFrontendErrorCard` | ❌ missing entirely | — | Port if wanted |
| Clear errors | `clearFrontendErrors` | ❌ missing | — | — |

---

## 14. Daily stats ("Nap értelmetlen statisztikája")

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Daily-stat editor | rotating slots, 6am rollover | ❌ missing entirely (data table read in `db.ts:172` but no editor/render) | — | Port editor |
| Formatting toolbar | B / I / `<br>` / flag | ❌ missing | — | — |

---

## 15. Leads / Érdeklődők

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| List leads | `listInterest` | 🟡 static "nincs adatforrás bekötve" placeholder (`page.tsx:945`); landing has no lead form either | ❌ | Add leads form + list endpoint |

---

## 16. Backup / Export / Import / Restore

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Export JSON | `exportDB` | 🟡 **UI exports client-side from `/api/state`** (`page.tsx:964`); the route's richer `export` action (full raw state, INV-09 redaction, `backup/route.ts:47-72`) is **never called** | ✅ route (unused) | Optionally use the route export |
| Import / Restore JSON | `importDB` (dry-run + diff) | 🔴 **route fully implemented** (dry-run diff + confirm apply, INV-11, `:74-176`) but **UI sends only `{action:'restore', file: file?.name}`** — never the file **contents**, never `confirm` (`page.tsx:1026,1057`) → route hits the empty dry-run branch → **restore is a no-op**; whole route effectively unreachable | ✅ route, 🔴 wiring | Read file contents, send payload + confirm step |
| Auto restore-point | implied | 🟡 promised in copy; depends on restore working | — | — |

---

## 17. Version & diagnostics

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Self-test / diagnostics | `getDbStats` (counts, empty-PIN warning) | ✅ **new & fully wired** — `GET /api/admin/diagnostics` (`page.tsx:1136`, route `:36-139`): DB connectivity, write-health sentinel, encoded-name integrity, Convex↔Neon parity, derived-ranking sanity, PIN provisioning | ✅ `diagnostics` | — |
| Version compare / deploy-version check | `checkDeployVersion` (index ↔ frontend ↔ backend) | ❌ not ported | — | Add version diagnostics |
| Post-WC todo box | `postWcTodoHtml` | ❌ missing | — | low priority |
| Notifications (PWA) | `requestNotifications` | ❌ missing | — | — |

---

## Priority gaps (ranked by operational impact)

The Round-1 story ("only `/api/admin/result` exists; every other write fails") is gone — the backend matured dramatically. The Round-2 dominant issues are **wiring and data-source confusion**:

1. **🔴 Txn-log table mismatch (highest impact).** Admin writes go to `txnlog` (exposed as `state._txnlog`) but the Log + Dashboard UI render `state.swissLog`. Admin actions are invisible in the log, and **rollback is broken** because it feeds `swissLog` timestamps to a route that queries `txnlog`. The correct data (`_txnlog`) is already in state and unused.
2. **🔴 Backup restore is a no-op.** The route has full dry-run/diff/apply logic, but the UI transmits only the filename — never the file contents and never `confirm`. The route's own `export` action is also never called. No safe restore path exists despite a sophisticated backend.
3. **🔴 Manual poll button → 404.** UI calls `/api/admin/poll`; only `cron/poll` exists. The emergency LiveScore control always errors.
4. **🔴 KO penalties dropped + result writes unlogged.** The result route + UI handle only `h/a`; `pen_h/pen_a` exist in schema and backup but are uncapturable via the results admin (KO-scoring truth gap). Result save/clear also never log to `txnlog`.
5. **🟡 Real endpoints with no UI caller.** `players` `rename` (✏️ button is still a `showToast` stub) and `restore` + deleted-list; `swiss` `add`/`remove`. The backend caught up; the frontend didn't.
6. **🔴 10 vs 30-day restore-window text mismatch** — UI copy says 30 days; route constant is 10 days (spec = 10).
7. **❌ Admin auth hardening absent** — single shared `ADMIN_TOKEN`, no rate limiting, no TOTP/biometric; login is client-only `setAuthed(true)`.
8. **❌ Leagues editor, KO manual override, player/admin PIN management, name-merge, LiveScore key/secret + autosync** — no UI and no route.
9. **❌ Frontend error log, daily-stats editor, leads list/form, version/deploy-version check** — not ported.
10. **🟡 Recompute is implicit-on-read** — no explicit pipeline trigger; the dashboard "recompute" button only re-reads state. Acceptable if derive-on-read is trusted, but there is no manual safety lever.

**Net count:** of 8 admin routes — **4 truly production-wired** (`result` minus penalties/logging, `override`, `bonus`, `diagnostics`), **3 real-but-mis/under-wired** (`players`, `swiss`, `log`), **1 real-but-dead** (`backup`), plus **1 phantom path** (manual poll → 404).

---

## Status tally (admin)

| | ✅ | 🟡 | ❌ |
|---|---|---|---|
| Round 1 (approx) | ~7 | ~22 | ~28 |
| **Round 2** | **15** | **18** | **22** |

(The 🟡 bucket is now mostly "real backend, mis-wired UI" rather than Round-1's "UI with no backend." Several 🟡/🔴 rows are a one-line fix away from ✅ — point the log/rollback UI at `state._txnlog`, send file contents on restore, add the `admin/poll` route, wire the ✏️/restore/swiss-add/remove buttons.)

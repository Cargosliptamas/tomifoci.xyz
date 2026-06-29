# Classic ↔ Rewrite — Admin Feature-Parity Audit

> Scope: ADMIN console only. Classic source = `Vb_Tippjatek_2026/js/admin-*.js`, `js/game-actions.js`, `SPEC_DIGEST.md`.
> New app = `tomifoci.xyz/app/admin/page.tsx` + `app/api/**`.
> Status legend: ✅ present (works) · 🟡 partial (UI exists but no working backend, or feature reduced) · ❌ missing.
>
> **Backend reality:** the new admin's `write()` helper POSTs to `/api/admin/{path}`. The **only** route that exists is
> `/api/admin/result`. Every other path (`players`, `override`, `bonus`, `swiss`, `poll`, `log`, `backup`) resolves to a
> non-existent route → the UI shows **"Backend még nincs bekötve"**. Auth model also differs: classic uses an admin **PIN**
> (`/api/auth/admin-pin`, Neon+Convex, rate-limited) + optional **TOTP**; new admin uses a single **`ADMIN_TOKEN`** header.

---

## 1. Login & Authentication

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Admin login | PIN → `POST /api/auth/admin-pin` (Neon primary, Convex fallback), `{ok, retryAfterMs}` | 🟡 `ADMIN_TOKEN` typed into a field; `setAuthed(true)` **client-side only**, no server verify until a write is attempted | No dedicated login route; token only checked by `/api/admin/result` | Decide auth model. If keeping token, add a verify endpoint; if PIN parity wanted, add `/api/auth/admin-pin` |
| PIN rate limiting | `retryAfterMs` backoff on repeated failures | ❌ none (token equality only) | — | Add rate limiting / lockout to admin auth |
| TOTP 2FA setup | `setup2fa` → QR (otpauth), `confirm2fa` verifies first code, stores `adminTotp` | ❌ missing entirely | — | Port `admin-totp.js` (RFC 6238 via Web Crypto) + secret storage + gated login |
| TOTP test / disable | `test2fa` shows live code; `disable2fa` clears secret | ❌ missing | — | Same as above |
| 2FA login gate | `ADMIN_2FA_ENABLED` flag (currently `false`), secret kept in settings | ❌ missing | — | Carry the dormant flag forward |
| Face ID / Touch ID | `setupAdminBio`/`unlockAdminBio` (WebAuthn, local PIN unlock) | ❌ missing | — | Port biometric unlock if device-login parity wanted |
| Logout | n/a (PIN persisted in localStorage) | ✅ `⏏` button resets `authed`/`token`/`section` | n/a | — |

---

## 2. Dashboard / Overview (new-only framing)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Stat tiles (players/preds/results/round) | No single dashboard; stats live in Version card | ✅ Tiles computed from `/api/state` | `/api/state` (read) ✅ | — |
| System status panel | n/a | ✅ DB / scoring / swiss-round status | read-only | — |
| Recent log (dashboard) | n/a | 🟡 reads `state.swissLog` (not the real txn log) | read-only | Back with real txn log |

---

## 3. Recompute / Repair pipeline (INV-03)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Full recompute (both modes) | `runRepairScores` → `game:repairAllScores` (re-mirror + 6-step recompute) | 🟡 "Pontok teljes újraszámítása" button just calls `loadState()` (state computed live on read) | ❌ no recompute route | If truth mutations don't auto-recompute, add an explicit recompute trigger; otherwise label as "refresh" |
| Recompute-after-mutation (INV-03) | Server fires 6-step pipeline after every truth write | 🟡 derived state computed live in `buildPublicState`/`loadPublicStateFromNeon` on read; `/api/admin/result` upserts only | partial | Verify all derived tables (scores/rankings/wizard/swiss) reflect on read; confirm no stale persisted derived rows |
| Name consolidation / merge | `runConsolidateName` → `game:renamePlayer` (re-stitch data under old name) | ❌ missing | — | Add rename/merge endpoint with INV-02 cascade |

---

## 4. Leagues management

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Add league | `addLeagueRow` + autosave | ❌ no league editor | — | Add league editor + settings write |
| Rename league (remap members) | `saveAdminSettings` maps `leagueRename`, drops orphaned memberships | ❌ missing | — | Port rename-with-membership-remap |
| Delete league | `✕` row remove + autosave | ❌ missing | — | — |
| Private league toggle | `.lprv` checkbox → `privateLeagues[]` | ❌ missing (privacy not editable) | — | Port private-league flag |
| League display | Editable rows | 🟡 read-only "LIGA" column in Players table (first league only) | read | — |

---

## 5. Player lifecycle

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Add player | `addPlayerQuick` (name + PIN + leagues) → autosave | 🟡 "+ Új játékos" → `write('players',{action:'create'})` — **no name/PIN input**, no backend | ❌ `/api/admin/players` missing | Add create endpoint + input form |
| Edit player name | inline `.pname` → `saveAdminSettings` → `game:renamePlayer` cascade (INV-02) | 🟡 `✏️` button → `showToast('Backend még nincs bekötve')` | ❌ | Add rename endpoint w/ name cascade across all name-keyed tables |
| Edit league membership | `.plg` checkboxes per player | ❌ missing | — | Add membership editor |
| Set/change player PIN | `.ppin` → `auth:setPlayerPin` | ❌ missing (no PIN field) | ❌ | Add player-PIN endpoint |
| Set new admin PIN | `newPinInp` → `auth:setAdminPin` | ❌ missing | ❌ | Add admin-PIN change endpoint |
| Delete player (cascade) | `deletePlayer` — type-name confirm → `game:archiveAndDeletePlayer` (preds/favs/bonuses/account, Párbaj opponents get bye), **10-day** restore | 🟡 `🗑` → confirm → `write('players',{action:'delete'})`; **no backend**; copy says **30 days** (mismatch) | ❌ | Add delete-with-cascade endpoint; reconcile 10 vs 30-day window |
| Restore deleted player | `loadDeletedPlayers` (`game:listDeletedPlayers`) + `restorePlayer` (`game:restoreDeletedPlayer`), shows `daysLeft` | 🟡 static "Nincs törölt játékos" placeholder; no load, no restore; says 30 days | ❌ | Add list + restore endpoints |

---

## 6. Results (truth writes)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Save result (90-min) | `saveResult`/`autoSaveResult` → merge-upsert (INV-11) | ✅ `Mentés` → `POST /api/admin/result` (`ON CONFLICT … DO UPDATE`, INV-11 honoured) | ✅ `/api/admin/result` | — |
| Clear result | `clearResult` | ✅ `Törlés` → `/api/admin/result` `{action:'clear'}` (`DELETE … WHERE match_id`) | ✅ | — |
| KO penalties (pen_h/pen_a) | `rph`/`rpa` inputs for `stage==='ko'` written with result | ❌ **no penalty inputs** in new Results UI; route accepts only `h`/`a` | 🟡 route lacks pen fields | Add `pen_h`/`pen_a` to UI + route + schema write |
| Lock-aware match list | classic shows only `activeMR` (kickoff-aware) | 🟡 new shows first 60 by search, no lock filter | n/a | Optional — cosmetic |
| Recompute on save | server recompute fires (INV-03) | 🟡 live-on-read; result route does not call a pipeline | partial | Confirm derived reads update post-save |

---

## 7. KO / bracket team management

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Auto-derived KO slots | `state.koTeams` `auto`/`autoNote` badges (bracket.autoUpdateBracket) | 🟡 static info note only ("automatically derived… manual override in emergency") | — | Surface auto slots/state |
| Manual KO override | `koh`/`koa` inputs → `saveKoTeams` | ❌ no editor | ❌ | Add KO override endpoint + UI |
| Confirm/lock auto pairing | `confirmKoTeams` (🔒) on `auto && !confirmed` | ❌ missing | ❌ | Add confirm endpoint |

---

## 8. Prediction override (admin)

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Manual prediction override | `saveManualPrediction` → `game:adminSetPrediction` (bypasses kickoff lock, INV-10), updates Wizard mirror | 🟡 Override section (player+match+score) → `write('override', …)`; **no backend** | ❌ `/api/admin/override` missing | Add override endpoint (lock-bypass, wizard re-mirror, logged) |

---

## 9. Bonuses

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Award bonus | preset `+3` buttons per round (Csoport/R32/R16/NF/EF/Döntő) → `awardBonus` | 🟡 free-form pts + reason → `write('bonus',{action:'award'})`; **no backend** (more flexible UI, but doesn't persist) | ❌ `/api/admin/bonus` missing | Add award endpoint; preset round buttons optional |
| Revoke bonus | `removeBonus` (pops last entry) | 🟡 per-entry `Visszavonás` → `write('bonus',{action:'remove',index})`; no backend | ❌ | Add remove-by-index endpoint |
| Bonus list | per-player last-5 + total | ✅ list rendered from `state.bonuses` | read | — |

---

## 10. Swiss / Párbaj admin

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Start league + draw R1–2 | `swissStartLeague` → `swiss:startSwissLeague` (auto-include all, late-join, drop rename dups) | ❌ missing | ❌ | Add start-league endpoint (covers **late join** auto-inclusion) |
| Suggest pairings (preview) | `swissSuggest` → `swiss:suggestSwissPairings` (preview only) | 🟡 shows pairings read from `state.swissPairings`; **no suggest query** | ❌ | Add suggest endpoint (preview, no write) |
| Publish pairings | `swissPublish` → `swiss:publishSwissPairings` | 🟡 `write('swiss',{action:'publish',round})`; no backend | ❌ `/api/admin/swiss` missing | Add publish endpoint |
| Reshuffle rounds | `swissReshuffle` — **multi-round** checkboxes + note → `swiss:reshuffleSwissRounds` | 🟡 single-round `{action:'reshuffle',round}`; no note; no backend | ❌ | Add reshuffle endpoint (multi-round + note) |
| Remove player (no-show) | `swissRemove` / `swissRemoveAllRecommended` (2× missed → `flagged`) → `swiss:confirm…Removal(s)` + redraw | ❌ missing (no flagged list) | ❌ | Add removal endpoints + flagged surfacing |
| Restore removed player | `swissRestore` → `swiss:restoreSwissPlayer` | ❌ missing | ❌ | Add restore endpoint |
| Removed-players list | rendered from `swissProfiles[removedAtRound]` | ❌ missing | — | Surface removed list |
| Swiss log | `state.swissLog` per-action audit | 🟡 shown in Log/Dashboard, not in Swiss section | read | — |
| Standings freeze (after R10) | engine freezes standings | 🟡 status text "10. forduló után fagy be"; no admin control | read | Informational only |

---

## 11. LiveScore / API integration

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| API key/secret settings | `ls2KeyInp`/`ls2SecretInp` → `saveLsSettings` (INV-09: stripped from public state) | ❌ no key/secret inputs, no save | ❌ | Add admin-gated API-config write (keys never in `/api/state`) |
| Auto-sync toggle | `lsAutoInp` (`lsAutoSync`) | ❌ missing | ❌ | Add toggle |
| Manual API unlock modal | red confirm modal → `_manualApiEnabled` (session) | 🟡 emergency checkbox + confirm in ApiSection | — | — |
| Manual: fetch results | `adminSyncResults` (⬇ Eredmények) | 🟡 single "Kézi poll" → `write('poll',{manual:true})`; no backend | ❌ `/api/admin/poll` missing | Add poll endpoint |
| Manual: standings | `refreshApiStandings` (👥) | ❌ missing | ❌ | Add standings refresh |
| Manual: live scores | `refreshLiveScores` (📡) | ❌ (folded into single poll) | ❌ | — |
| Manual: fixtures+odds | `refreshFixturesAndOdds` (🎲) | ❌ missing | ❌ | Add odds refresh (Wizard depends on odds snapshots) |
| Friendly API test | `runFriendlyApiTest` → `LS.testFriendlyApiSearch` | ❌ missing | ❌ | Optional diagnostic |
| Cache freshness view | n/a | ✅ tiles + per-key freshness from `state.apiCache` | read | — |
| Auto poll (cron) | server cron | n/a (Vercel cron, outside admin) | — | Confirm cron exists |

---

## 12. Transaction log & rollback

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| View log | `renderTxnLogCard` — last 20 from `state._txnlog`, who/path/label | 🟡 LogSection renders `state.swissLog` (**not** the real txn log) | read | Wire a real txn-log source |
| Rollback entry | `rollbackTxn` → `game:rollbackTxn` (server restores pre-state if supported) | 🟡 `↩ Vissza` → `write('log',{action:'rollback',ts})`; **no backend** (UI admits "életbe lép a backend bekötése után") | ❌ `/api/admin/log` missing | Add rollback endpoint + eligibility flag |
| Rollback eligibility | server decides if entry is reversible | ❌ not surfaced | — | Surface per-entry eligibility |
| Clear log | `clearTxnLog` → `game:clearTxnLog` | 🟡 `Napló ürítése` → `write('log',{action:'clear'})`; no backend | ❌ | Add clear endpoint |
| CSV archive export | `downloadTxnArchive` → `game:allTxns` (full permanent archive) | 🟡 `CSV export` client-side from `swissLog` (partial, not full archive) | ❌ | Back with full archive query |

---

## 13. Frontend error log

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| JS error capture/view | `window.onerror`/`unhandledrejection` → localStorage (cap 60) → `renderFrontendErrorCard` | ❌ missing entirely | — | Port error capture + admin card |
| Clear errors | `clearFrontendErrors` | ❌ missing | — | — |

---

## 14. Daily stats ("Nap értelmetlen statisztikája")

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Daily-stat editor | rotating slots, save/add/remove, 6am rollover | ❌ missing entirely | — | Port editor + `dailyStats` settings write |
| Formatting toolbar | B / I / `<br>` / flag inserter (strong/em/br) | ❌ missing | — | Port toolbar |

---

## 15. Leads / Érdeklődők

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| List leads | `loadInterestLeads` → `leads:listInterest` (name/contact/message/EN badge/ts) | 🟡 static "nincs adatforrás bekötve" placeholder | ❌ no leads endpoint | Add leads list endpoint + render |

---

## 16. Backup / Export / Import / Restore

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Export JSON | `exportDB` | ✅ "Állapot exportálása" downloads `/api/state` JSON | ✅ `/api/state` | — |
| Import JSON | `importDB` (dry-run + diff) | 🟡 step UI (file → dry-run → diff → confirm) → `write('backup',{action:'restore'})`; **dry-run unavailable, no backend** | ❌ `/api/admin/backup` missing | Add restore endpoint with dry-run + diff |
| Auto restore-point | implied in import | 🟡 promised in confirm copy; not implemented | ❌ | Add pre-restore snapshot |

---

## 17. Version & diagnostics

| Feature / action | Classic behaviour | New admin status | Backend endpoint? | What's needed |
|---|---|---|---|---|
| Version compare | `renderVersionCard` + `checkDeployVersion` (index ↔ frontend ↔ backend via `game:getVersion`) | ❌ missing | — | Add version diagnostics |
| DB stats | `game:getDbStats` (players/pinHashes/predictions/favorites, empty-PIN warning) | 🟡 partial counts on Dashboard tiles; no PIN-hash health check | read | Add DB-health check (pin-hash warning) |
| Post-WC todo box | `postWcTodoHtml` (dismissible reminder) | ❌ missing | — | Low priority |
| Notifications (PWA) | `requestNotifications` + permission status | ❌ missing | — | Port if admin push wanted |

---

## Priority gaps (ranked by operational impact)

**Missing backend endpoints** — the new admin has UI for these but every write fails ("Backend még nincs bekötve"). Only `/api/admin/result` works.

1. **`/api/admin/players`** (create / rename-cascade / delete-with-cascade / restore) — INV-02 name cascade + 10-day window. Highest impact: player lifecycle is unusable; the 30-day copy also contradicts the 10-day spec.
2. **`/api/admin/override`** — admin prediction override (lock-bypass + Wizard re-mirror + log). Core "tipp didn't save" fix path.
3. **`/api/admin/result` penalties** — endpoint exists but drops KO `pen_h`/`pen_a`; KO results can't be recorded correctly.
4. **`/api/admin/swiss`** (start-league, suggest, publish, reshuffle multi-round+note, remove/remove-all, restore) — entire Párbaj operation, incl. **late join** and no-show removal, is non-functional.
5. **`/api/admin/bonus`** (award / remove) — advancement bonuses (+3/round) can't be applied.
6. **`/api/admin/log`** (rollback + eligibility + clear) and a **real txn-log source** — currently mislabelled onto `swissLog`; rollback is the key safety net.
7. **`/api/admin/poll`** + standings/odds refresh — emergency LiveScore controls; odds refresh feeds Wizard.
8. **`/api/admin/backup`** (restore with dry-run + diff) — no safe restore path; export works, import doesn't.
9. **Recompute trigger** — confirm INV-03: either derived reads fully reflect truth writes, or add an explicit recompute endpoint (the dashboard button currently only reloads).
10. **API config write** (ls2Key/ls2Secret/lsAutoSync, INV-09-safe) — no way to set API credentials or auto-sync from the new admin.

**Missing features (no UI at all in the new admin)** — beyond the endpoint gaps:

1. **Leagues editor** (add/rename-with-member-remap/delete/private toggle) — completely absent.
2. **KO team management** (manual override + confirm auto pairing) — info note only, no editor.
3. **Player/admin PIN management** (`setPlayerPin` / `setAdminPin`) — no PIN fields.
4. **TOTP 2FA + biometric unlock** — entire auth-hardening layer dropped; new admin is a single shared `ADMIN_TOKEN` with no rate limiting.
5. **Daily stats editor** + formatting toolbar — absent.
6. **Frontend error log** — absent.
7. **Version & DB diagnostics** (PIN-hash health warning) — absent.
8. **Name-merge/consolidation** tool — absent.
9. **Deleted-players list/restore** — placeholder only.
10. **Leads list** — placeholder only.

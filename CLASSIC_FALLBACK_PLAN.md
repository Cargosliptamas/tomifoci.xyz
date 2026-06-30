# Classic-Game Fallback — Build Plan

> Status: **PLAN ONLY** (approved 2026-06-30, build deferred to a later session).
> Goal: ship the original "classic" UI as a working fallback at **`/classic`** in the
> `tomifoci.xyz` app, reading and writing the **same Neon database** as the new game, so
> data is identical in both. If the new UI ever breaks, players can use the classic UI.

---

## 1. The core problem (why this is not a file copy)

The classic game (`Vb_Tippjatek_2026/` root: `index.html` + `js/*.js` + `css/*.css`) is a
vanilla-JS app whose entire data layer is **Convex-bound**:

- `js/config.js` sets `window.CONVEX_URL` to a live Convex deployment.
- `js/convex-bridge.js` opens a `ConvexClient` and exposes `cvxMut()`, `cvxQry()`, and a
  reactive `attachConvexStateListener()` → `anyApi.game.state`.
- `js/store.js` attaches that listener once and treats the pushed `state` object as truth.
- Every action calls `cvxMut('module:fn', args)` / `cvxQry('module:fn', args)`.

Convex is **retired**; Neon is the only live DB. So the static assets copy trivially, but
**the bridge must be rewired** to the new Neon-backed API. That rewire is the whole job.

The good news: the migration was *designed* for this — `PROJECT-GOVERNOR.md §3` already
reserved a **`/classic/` path** as the "classic backup… until smoke tests pass."

---

## 2. Strategy

Replace exactly **one file** — `js/convex-bridge.js` — with a **Neon-API shim** that keeps
the same global surface (`cvxMut`, `cvxQry`, `attachConvexStateListener`) so none of the
~25 other `js/*.js` files need to change. Two pieces:

1. **Reads** — replace the reactive Convex subscription with **polling** of the existing
   `GET /api/state`, passed through a **shape adapter** (new state → classic state shape).
2. **Writes** — map each `cvxMut('module:fn', …)` call to the matching new API route.

```
classic js/*.js  ──cvxMut/cvxQry──▶  NEW convex-bridge shim  ──fetch──▶  /api/* (Neon)
classic store.js ──attachListener──▶  poll GET /api/state ──adapter──▶ classic state{}
```

Serve the static classic assets from Next.js under `/classic` (e.g. `public/classic/**`
or a route handler), with `window.COMMUNITY` derived from the path as today.

---

## 3. Call-mapping inventory (classic → new route)

39 distinct Convex targets found in `js/` (`grep -rhoE "cvx(Mut|Qry)\(...)"`). Mapping:

### Player-facing (must work for a usable fallback)
| Classic call | New route | Notes |
|---|---|---|
| `game:state` | `GET /api/state` | **The big one.** Needs a shape adapter (§4). |
| `game:savePrediction` | `POST /api/predictions` | verify body shape `{player,matchId,h,a}` |
| `game:setFavorite` | `POST /api/favorites` | |
| `wizard:savePick` | `POST /api/wizard` | |
| `wizard:setWizardProfile` | `POST /api/wizard` | opt-in / mirror / leave toggles |
| `auth:checkPlayerPin` | `POST /api/auth/player-pin` | returns `{ok, retryAfterMs}` — confirm throttle |
| `auth:setPlayerPin` | `POST /api/auth/change-pin` | |
| `auth:playerHasPin` | derive from `/api/state` or `player-pin` | **verify a source exists** |
| `game:savePushSubscription` | `POST /api/push/subscribe` | |
| `wizard:snapshotKickoffOdds` | (likely server-side now) | **verify**; may become a no-op |
| `game:getVersion` | static / `/api/state` field | low priority |

### Admin-facing (only if the fallback admin is in scope)
| Classic call | New route |
|---|---|
| `auth:checkAdminPin` / `auth:setAdminPin` | admin token model — **needs reconciliation** (new app uses `ADMIN_TOKEN`, not a checkAdminPin RPC) |
| `game:saveResult` / `clearResult` / `setResults` | `POST /api/admin/result` |
| `game:setBonuses` | `POST /api/admin/bonus` |
| `game:adminSetPrediction` / `setPredictionsForPlayer` | `POST /api/admin/override` |
| `game:renamePlayer` / `archiveAndDeletePlayer` / `listDeletedPlayers` / `restoreDeletedPlayer` | `POST /api/admin/players` |
| `game:getDbStats` / `repairAllScores` | `POST /api/admin/diagnostics` (verify) |
| `game:allTxns` / `clearTxnLog` / `rollbackTxn` | `POST /api/admin/log` |
| `game:getAdminConfig` / `saveSettings` / `setKoTeams` | `admin/override` (verify) |
| `swiss:*` (8 calls) | `POST /api/admin/swiss` |

### Out of scope for fallback
| Classic call | Disposition |
|---|---|
| `migrate:importAll` | one-time migration; **drop** |
| `leads:listInterest` / `leads:submitInterest` | landing lead-capture — **verify if new app has it**; stub or drop |

---

## 4. The hard part: state-shape adapter

Classic `store.js` consumes the Convex `game:state` shape (per legacy `CLAUDE.md`):

```
state.predictions[player][matchId] = {h, a}
state.results[matchId]             = {h, a}
state.rankings["{scope}_{league}"] = [rows]
state.scores.byMatch
state.wizardProfiles / state.wizardPicks / state.wizardRankings
state.swiss / state.swissProfiles / state.swissPairings / state.swissLog
liveScores, matchOdds, currentPlayer, adminOk
```

The new `GET /api/state` (`lib/client-state.ts buildPublicState`) emits its **own** shape.
**Phase 0 task:** diff the two shapes field-by-field and write a pure
`adaptStateToClassic(newState) → classicState` function (unit-tested). This is where the
risk and effort concentrate — most other steps are mechanical.

---

## 5. Phasing & effort

| Phase | Work | Est. |
|---|---|---|
| **P0 — Recon** | Read new `/api/state` shape + each player route's request/response; produce the field-diff and confirm the "verify" rows in §3. Confirm `playerHasPin`, `snapshotKickoffOdds`, `leads:*`, admin-auth model. | 0.5 day |
| **P1 — Read path** | `adaptStateToClassic()` + polling loop replacing `attachConvexStateListener`; render the classic UI read-only against live Neon data. **Milestone: classic UI shows correct standings/predictions/tables.** | 1 day |
| **P2 — Write path (player)** | Map the player-facing `cvxMut` calls to routes; predictions, favorites, wizard picks/profile, PIN. **Milestone: a player can log in + tip via the classic UI.** | 1 day |
| **P3 — Serve + link** | Host static assets at `/classic`; add a link on the new landing (`app/page.tsx`) → "Klasszikus játék". | 0.5 day |
| **P4 — Admin (optional)** | Reconcile admin-auth model, map `admin/*` + `swiss/*`. Only if a fallback admin is wanted. | 1–2 days |

**Player-only fallback (P0–P3): ~3 days.** Admin parity adds 1–2 days.

---

## 6. Risks & open questions
- **State shape drift** (highest): if the adapter misses a field, a classic tab renders
  blank. Mitigate with a shape unit test seeded from a real `/api/state` snapshot.
- **Polling vs. reactive**: classic expected live push; polling adds latency. Match the new
  app's existing poll interval (`components/game-provider.tsx`).
- **Admin-auth mismatch**: classic used `checkAdminPin` RPC; new app uses `ADMIN_TOKEN`.
  Needs a decision before P4.
- **Community (`hu`/`en`)**: classic switches on `location.pathname.startsWith('/en')`;
  confirm `/api/state` accepts a community param.
- **Write contract drift**: each new route may validate a different body shape than the
  classic `cvxMut` args — verify per route in P0, don't assume.

---

## 7. First action when build is greenlit
Start P0: snapshot `GET /api/state` from production, capture the classic `state` shape from
`js/store.js`, and write the field-diff that drives `adaptStateToClassic()`.

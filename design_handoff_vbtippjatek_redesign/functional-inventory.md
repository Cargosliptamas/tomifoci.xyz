# Tomifoci Redesign Functional Inventory

Date: 2026-06-28

Purpose: prepare a frontend design handoff while preserving the current database/data model. This inventory maps the existing user interface surfaces to backend functions, identifies missing or ambiguous seams, and lists what Claude Design must address to produce a usable redesign.

## Source Boundary

Read sources:

- Static legacy shell: `index 2.html`, `index.html`, `sw.js`
- Legacy frontend modules: `js/*.js`, `css/*.css`
- Current backend: `convex/*.ts`, `convex/schema.ts`
- Partial rewrite: `apps/rewrite/app/**`, `apps/rewrite/lib/**`, `apps/rewrite/db/schema.ts`
- Migration docs: `CLAUDE.md`, `docs/migration/vercel-neon-rewrite.md`, `plans/MASTER-BRIEF.md`

Important conflict: repository docs disagree about direction. `CLAUDE.md` and `docs/migration/vercel-neon-rewrite.md` describe a Next/Vercel/Neon-style rewrite path, while `plans/MASTER-BRIEF.md` says the live production stack should remain vanilla JS + Convex + Cloudflare for tournament safety. For this redesign brief, treat the database and persisted game model as fixed. The frontend and backend implementation can change only if the data contract is preserved or migrated deliberately.

## Current Product Shape

Tomifoci is a 2026 World Cup prediction game with three main audiences:

- Public/player users: log in, submit predictions, track points, view leaderboard, follow matches, manage profile and notifications.
- Admin/game owner: manage players, predictions, results, leagues, API polling, Swiss pairings, bonuses, rollback, deleted players, and diagnostics.
- Prospective users: view beta landing pages and optionally submit interest.

Current app surfaces:

- Root `index.html`: relocation/cache cleanup page pointing to `https://tomifoci.xyz/`.
- `index 2.html`: full legacy static app shell and script loader.
- `apps/rewrite`: partial Next app with landing pages, player login, and placeholder admin shell.
- Convex backend: current source of truth for realtime state, scoring, auth, cron polling, push, Wizard, Swiss, rollback, deleted-player restore, and leads.

## A. Frontend Inventory

| FE ID | Site/surface | Function name | Intended working | How it works in practice | Matching backend ID |
|---|---|---|---|---|---|
| FE-001 | Root relocation page | Legacy site redirect | Move users from old Cloudflare/static location to canonical Tomifoci site. | `index.html` shows relocation UI, unregisters service workers, clears caches, and links/redirects to `https://tomifoci.xyz/`. | BE-027 |
| FE-002 | Legacy service worker | Cache cleanup and push tap handler | Keep old installs from serving stale assets and route notification taps to the game. | `sw.js` deletes old caches, uses network-first fetch, unregisters itself on schedule messages, and opens `https://tomifoci.xyz/` on notification click. | BE-020 |
| FE-003 | Next HU/EN landing | Public beta landing | Present public status, brand, language choice, and login CTA. | `apps/rewrite/app/page.tsx` and `/en/page.tsx` render `PublicBetaLanding` from typed landing copy. | BE-031 |
| FE-004 | Next landing controls | Skin/status/news panels | Show theme variant, platform status, build messaging, and route users into login. | `PublicBetaLanding` contains matchday/classic skins, status cards, news board, logo showcase, and login links. | BE-031 |
| FE-005 | Next player login | Player selection | Load current player list and let a player select their profile. | `PlayerLogin` calls `/api/state?community=...`, normalizes `settings.players`, filters/searches, then stores selected player. | BE-001, BE-031 |
| FE-006 | Next PIN login | Player PIN verification | Verify player identity before entering the classic game. | `PlayerLogin` posts `{ player, pin, community }` to `/api/auth/player-pin`, caches local player/PIN markers, and redirects to `/classic/index.html`. | BE-002, BE-032 |
| FE-007 | Next biometric login | Local biometric unlock | Reduce repeated PIN entry on the same device. | `PlayerLogin` uses local WebAuthn helpers and browser local storage markers; backend still relies on PIN verification for first setup. | BE-002 |
| FE-008 | Legacy welcome overlay | Entry and interest capture | Give unauthenticated visitors a low-friction path to enter or register interest. | `#wOverlay` in `index 2.html` has enter buttons and `submitInterest()` posting name/contact/message. | BE-026 |
| FE-009 | Legacy app frame | Tabs, drawer, auth gate | Provide the main game navigation and guard player-only screens. | `js/app.js` renders tabs `lb`, `pred`, `wizard`, `swiss`, `matches`, `groups`, `profile`, `about`, `admin`; unauthenticated users are sent to login. | BE-001 |
| FE-010 | Player modal | Player login, filtering, local unlock | Let players choose themselves, enter PIN, and optionally use biometric unlock. | `js/ui.js` filters players, verifies PIN through Convex, stores current player locally, and contains WebAuthn helpers. | BE-002, BE-003 |
| FE-011 | Leaderboard | Scores and rank views | Show overall standings, scope filters, private leagues, live deltas, Wizard and Swiss summary ranks. | `renderLeaderboard()` consumes server-derived `playerScores`, `rankings`, `wizardRankings`, `swissStandings`, plus settings. | BE-001, BE-013, BE-022, BE-023 |
| FE-012 | Player history modal | Read-only player drilldown | Let users inspect another player's prediction and competition history. | `render-player-history.js` opens a modal from clickable names and renders prediction/Wizard/Swiss sections from global state. | BE-001 |
| FE-013 | Predictions dashboard | Prediction entry context | Show rules, stats, past results, upcoming matches, and reminders. | `renderPredictions()` builds cards from match data, server results, current player predictions, and derived stats. | BE-001, BE-029 |
| FE-014 | Prediction save | Save score predictions | Capture score steppers and persist prediction changes before kickoff lock. | `savePred()` writes both team scores through the legacy `fbSet('predictions/...')` shim, which calls bulk Convex mutation. | BE-005 |
| FE-015 | Favorite team | Favorite selection | Let each player select a favorite team for bonus/scoring display. | Favorite modal/profile controls call `game:setFavorite` through `fbSet('favorites/...')`. | BE-006 |
| FE-016 | Wizard profile | Wizard league opt-in/profile | Let users join Wizard and configure visibility/name. | `joinWizardLeague()` and `saveWizardProfile()` call `wizard:setWizardProfile`. | BE-021 |
| FE-017 | Wizard picks | 1/X/2 picks and mirroring | Let users pick outcomes with odds and mirror hints, while locking at kickoff. | `render-wizard.js` displays picks; `saveWizardPick()` calls `wizard:savePick`; backend also mirrors predictions internally. | BE-021, BE-022 |
| FE-018 | Swiss/Parbaj tab | Swiss duel competition | Show current round, pairings, standings, history, beta disclaimer, and events log. | `render-swiss.js` renders from `state.swiss*`; participation now reads as automatic, though a profile save function still exists. | BE-023, BE-024, BE-025 |
| FE-019 | Match Centre | Match lists and schedule | Show live, recent, upcoming, archived, and full-schedule match views. | `render-matchcentre.js` categorizes match cards from static data, results, live API cache, and match events. | BE-001, BE-017, BE-018 |
| FE-020 | Match modal | Match detail, events, lineups | Inspect a match, scoring breakdown, odds, events, and lineups; allow admin/manual refresh. | `openMatchModal()` renders event/lineup tabs; refresh calls manual LiveScore helpers in `sync.js` when enabled. | BE-017, BE-018 |
| FE-021 | Groups and bracket | Standings and knockout bracket | Show group tables, knockout bracket, third-place matrix, and refresh controls. | `render-groups.js` and `render-bracket.js` consume static match data, `state.apiCache`, `state.koTeams`, and `state.bracket`. | BE-017, BE-019, BE-030 |
| FE-022 | Profile | Player settings and diagnostics | Show personal stats, favorite, notification setup, biometric setup, cache clear, and PIN change. | `render-profile.js` consumes state and calls PIN/favorite/notification/cache helpers. | BE-002, BE-003, BE-006, BE-016 |
| FE-023 | Notifications | Push subscription and local alerts | Register browser push, schedule local kickoff reminders, and dedupe result notifications. | `notify.js` requests permission, subscribes push, saves endpoint, and handles local service-worker scheduling/results. | BE-016, BE-020 |
| FE-024 | Offline/realtime state | Resilient state loading | Keep the app usable through temporary Convex/network issues. | `store.js` loads `game:state`, subscribes with `attachConvexStateListener`, stores offline backup, and shows offline banner. | BE-001 |
| FE-025 | Admin login | Admin PIN, optional TOTP, biometric | Protect admin console with PIN and optional second factor. | `admin-core.js` calls `auth:checkAdminPin`, loads `game:getAdminConfig`, and uses `admin-totp.js` for TOTP flows. | BE-002, BE-015 |
| FE-026 | Admin settings | Leagues, players, player PINs, admin PIN | Maintain players, private leagues, admin PIN, player PINs, labels, and settings. | `saveAdminSettings()` calls `game:renamePlayer`, `auth:setAdminPin`, `auth:setPlayerPin`, and `game:saveSettings`. | BE-003, BE-012, BE-015 |
| FE-027 | Deleted players | Archive and restore player data | Remove a player safely and restore within retention window. | Admin UI calls `game:archiveAndDeletePlayer`, `game:listDeletedPlayers`, and `game:restoreDeletedPlayer`. | BE-011 |
| FE-028 | Admin LiveScore | API configuration and manual polling | Configure LiveScore credentials and run emergency/manual refreshes. | Admin settings save credentials; manual buttons call client-side `LS.*` helpers and related Convex cache mutations only when manual API is enabled. | BE-015, BE-017, BE-018, BE-019 |
| FE-029 | Admin results/KO | Enter or clear results and KO teams | Correct match results and knockout team slots. | `saveResultAdmin()`, `clearResultAdmin()`, and KO helpers call result/KO Convex mutations. | BE-007, BE-008, BE-013, BE-030 |
| FE-030 | Admin prediction override | Correct player predictions | Override a player's prediction for a match and recompute scores. | `saveManualPrediction()` calls `game:adminSetPrediction`, then recompute is scheduled. | BE-010, BE-013, BE-022 |
| FE-031 | Admin bonuses | Award/remove bonus points | Give or reverse manual player bonuses. | Bonus UI writes through `game:setBonuses`; legacy direct award/remove mutations also exist. | BE-009 |
| FE-032 | Admin transaction log | Audit, rollback, clear, CSV | Inspect recent admin/player writes and roll back supported changes. | `admin-txnlog.js` calls `game:allTxns`, `game:rollbackTxn`, and `game:clearTxnLog`; rollback currently supports prediction transactions. | BE-014 |
| FE-033 | Admin Swiss | Pairing and Swiss operations | Suggest/publish pairings, start league, reshuffle, remove/restore players. | `renderSwissAdminCard()` calls `swiss:*` admin mutations for pairings and removals. | BE-025 |
| FE-034 | Admin diagnostics | Repair, version, DB stats, errors, daily stats | Keep operations visible and recover from stale derived state. | Admin calls `game:repairAllScores`, `game:getVersion`, `game:getDbStats`, `game:getDailyStats`, and displays frontend error/state panels. | BE-013, BE-015 |
| FE-035 | Admin interest leads | View beta signups | Let admin inspect interest submissions from landing/welcome form. | Admin lead panel calls `leads:listInterest`; no mark-handled UI was found. | BE-026 |
| FE-036 | Data export/import | Backup and restore game JSON | Let admin export current state and import legacy data. | `exportDB()` downloads JSON; `importDB()` writes root payload through `migrate:importAll`. This is powerful and should be redesigned as a gated restore flow. | BE-028 |

## B. Backend Inventory

| BE ID | Backend function/module | Type | Intended working | How it works in practice | Frontend matches |
|---|---|---|---|---|---|
| BE-001 | `game:state` | Query | Return complete client state for a community. | Reads settings, predictions, results, KO teams, favorites, bonuses, API cache, derived scores/rankings, Wizard, and Swiss; strips secrets and filters by community. | FE-005, FE-009, FE-011-FE-024 |
| BE-002 | `auth:checkPlayerPin`, `auth:checkAdminPin`, `auth:playerHasPin` | Query/mutation | Verify player/admin identity and PIN status. | Uses hashed PIN rows and `authAttempts` throttling. Admin check supports bootstrap behavior and optional config paths. | FE-006, FE-010, FE-022, FE-025 |
| BE-003 | `auth:setPlayerPin`, `auth:setAdminPin`, `auth:seedAdmin` | Mutation/internal | Manage player/admin PIN credentials. | Admin-gated PIN writes store hashes; internal seed supports first setup. | FE-010, FE-022, FE-026 |
| BE-004 | `game:savePrediction` | Mutation | Save one prediction. | Server-side player PIN check and kickoff lock; appears less used than bulk path. | Future/optional |
| BE-005 | `game:setPredictionsForPlayer` | Mutation | Save a player's prediction map. | Bulk write behind legacy `fbSet('predictions/...')`; enforces player PIN and locks. | FE-014 |
| BE-006 | `game:setFavorite` | Mutation | Save player favorite team. | Player scoped, community-aware favorite write. | FE-015, FE-022 |
| BE-007 | `game:saveResult`, `game:clearResult`, `game:setResults`, `game:autoUpsertResults` | Mutations | Maintain match results. | Admin/manual and API-assisted paths write results and schedule recompute. | FE-029 |
| BE-008 | `game:setKoTeams`, `game:saveKoTeams`, `game:getKoTeamsById` | Query/mutation | Maintain knockout team slot resolution. | Bulk and targeted KO writes support bracket/team resolution. | FE-021, FE-029 |
| BE-009 | `game:setBonuses`, `game:awardBonus`, `game:removeLastBonus` | Mutations | Maintain manual bonus points. | UI mostly uses bulk bonus writes; direct award/remove mutations also exist. | FE-031 |
| BE-010 | `game:adminSetPrediction` | Mutation | Admin-correct a player's prediction. | Admin-gated write with transaction log and recompute; also interacts with Wizard mirroring. | FE-030 |
| BE-011 | `game:archiveAndDeletePlayer`, `game:restoreDeletedPlayer`, `game:listDeletedPlayers`, `game:purgeExpiredDeletions`, `game:deletePlayerData` | Query/mutation/internal | Safe player removal and restore. | Archives player data, cascades deletes, restores within retention window, and purges expired deletions. Hard delete exists but should not be normal UI. | FE-027 |
| BE-012 | `game:renamePlayer` | Mutation | Rename/consolidate player identity. | Admin-gated rename updates player references and related records. | FE-026, FE-034 |
| BE-013 | `game:repairAllScores`, recompute scheduler | Mutation/internal | Rebuild derived scores/rankings after writes. | Schedules bracket, scoring, rankings, Wizard scoring/rankings, and Swiss compute steps. | FE-011, FE-029, FE-030, FE-034 |
| BE-014 | `game:allTxns`, `game:rollbackTxn`, `game:clearTxnLog` | Query/mutation | Audit and reverse supported writes. | Logs transactions and can roll back prediction transactions; clear/archive paths support admin maintenance. | FE-032 |
| BE-015 | `game:saveSettings`, `game:getAdminConfig`, `game:getDbStats`, `game:getVersion`, `game:getDailyStats`, `game:saveEnSettings`, `game:getLsCredentials` | Query/mutation | Admin settings, diagnostics, and secret/config access. | Settings writes include players/leagues/API config; public state strips secrets while admin config exposes controlled operational data. | FE-025, FE-026, FE-028, FE-034 |
| BE-016 | `game:savePushSubscription`, `game:listPushSubs`, `game:removePushSub` | Query/mutation | Store and maintain browser push subscriptions. | Subscription records are written from client; dead endpoints are pruned by push sends. | FE-023 |
| BE-017 | `game:putApiCache`, `game:getApiCacheByKind`, `game:mergeApiCacheOdds`, poll-lock and match-map helpers | Query/mutation | Maintain LiveScore cache, event flags, odds, and poll safety. | Stores fixtures, live results, odds, standings, events, and match mapping; protects poll with a lock. | FE-019, FE-020, FE-021, FE-028 |
| BE-018 | `livescore:pollLive` | Internal action | Poll live scores, history, events, fixtures, and odds. | Uses LiveScore API key/secret from env or settings, writes cache/results, updates match-map state, triggers notifications/recompute. | FE-019, FE-020, FE-028 |
| BE-019 | `livescore:pollStandings` | Internal action | Poll group standings. | Cron/internal path fetches standings and writes API cache. | FE-021, FE-028 |
| BE-020 | `push:sendResult`, `push:sendCustom`, `push:sendFullTime`, `push:sendDailyStat`, `push:sendBonus` | Internal actions | Send web-push notifications. | Uses stored push subscriptions, sends result/full-time/daily/bonus notifications, and prunes invalid endpoints. | FE-002, FE-023 |
| BE-021 | `wizard:setWizardProfile`, `wizard:savePick`, `wizard:snapshotKickoffOdds` | Mutations | Manage Wizard participation, picks, and odds snapshots. | Enforces kickoff locks, stores 1/X/2 picks, and snapshots odds at kickoff. | FE-016, FE-017 |
| BE-022 | Wizard internals: `mirrorFromPrediction`, `backfillWizardPicks`, `computeWizardScores`, `updateWizardRankings` | Internal/admin | Derive Wizard picks, scores, and ranks. | Mirrors predictions, applies odds/peer/floor logic, computes standings, and updates rankings. | FE-011, FE-017, FE-030 |
| BE-023 | `swiss:computeSwiss` | Internal | Compute Swiss/Parbaj standings from pairings/results. | Reads pairings/results/removals and writes standings/logs. | FE-011, FE-018 |
| BE-024 | `swiss:setSwissProfile` | Mutation | Maintain Swiss profile/preferences. | Still present, although UI copy now says Swiss participation is automatic. | FE-018 |
| BE-025 | Swiss admin mutations: `suggestSwissPairings`, `publishSwissPairings`, `startSwissLeague`, `reshuffleSwissRounds`, `confirmSwissRemoval`, `confirmSwissRemovals`, `restoreSwissPlayer`, `autoPublishDue` | Mutations/internal | Operate Swiss league rounds. | Suggests/publishes pairings, starts league, handles removals/restores, and auto-publishes due rounds. | FE-033 |
| BE-026 | `leads:submitInterest`, `leads:listInterest`, `leads:setHandled` | Mutation/query | Capture and manage interest leads. | Public submit stores lead; admin list reads leads; handled-state mutation exists but no matching UI was found. | FE-008, FE-035 |
| BE-027 | `health:http`, `/health` | HTTP action | Public operational health endpoint. | Returns version, deployment timestamp, counts, and poll freshness without secrets. | FE-001 |
| BE-028 | `migrate:importAll` | Mutation | Import legacy/full JSON state. | Root import path behind legacy `fbSet('', data)`; high-risk because it can overwrite broad state. | FE-036 |
| BE-029 | `scoring:calcPts`, `computeAllScores`, `updateRankings` | Internal/domain | Score predictions and build rankings. | Derives player score rows and rankings from predictions/results/bonuses/favorites. | FE-011, FE-013 |
| BE-030 | `bracket:autoUpdateBracket` | Internal/domain | Derive knockout bracket and related team slots. | Updates bracket/KO state from results and tournament rules, then feeds scoring/display. | FE-021, FE-029 |
| BE-031 | `apps/rewrite/app/api/state/route.ts` | Next API route | Proxy client state to Next frontend. | Calls `queryConvex('game:state')`, returns no-store JSON, maps failures to 502. | FE-003, FE-004, FE-005 |
| BE-032 | `apps/rewrite/app/api/auth/player-pin/route.ts` | Next API route | Proxy player PIN login to Next frontend. | Validates request with zod and calls `mutateConvex('auth:checkPlayerPin')`. | FE-006 |
| BE-033 | `apps/rewrite/db/schema.ts` | Schema scaffold | Model future relational database while preserving current tables. | Defines typed tables for settings/predictions/results and JSON key-value fallback tables for other Convex tables. | Future rewrite |
| BE-034 | `apps/rewrite/lib/migration/migration-plan.ts` | Migration plan | Map Convex tables to rewrite persistence plan. | Lists roles/cutover approach for settings, predictions, scores, Wizard, Swiss, auth, leads, API cache, deleted players, etc. | Future rewrite |

## C. Frontend/Backend Crosswalk And Gaps

| Area | Frontend coverage | Backend coverage | Gap/risk | Design action |
|---|---|---|---|---|
| Canonical app route | Legacy full shell exists as `index 2.html`; root is relocation page; Next login redirects to `/classic/index.html`. | Backend still Convex-first. | `/classic/index.html` is not visible in repo file list; deployment packaging must be verified. | Design must name the canonical route tree and migration route for old installs. |
| Landing | Next HU/EN landing is polished and typed. | Only needs `game:state` for login; not deeply backend-bound. | Landing copy says Vercel/Neon/game unchanged while current backend still proxies Convex. | Avoid platform claims in UI unless final stack is confirmed. |
| Player login | Next login supports state load, PIN, and biometric local flow. | Convex auth and Next proxy exist. | Login redirects into classic static game, not a redesigned app. | Design should specify post-login dashboard destination and session model. |
| Core player game | Legacy static app has complete leaderboard, predictions, Wizard, Swiss, match center, groups, profile. | Convex state and mutations are complete. | Next rewrite has no player-game screens yet. | Design must include all major gameplay views, not just marketing/login. |
| Admin | Legacy admin is comprehensive. | Convex admin backend is comprehensive. | Next `/admin` is placeholder. | Design must treat admin as a first-class operational console. |
| Interest leads | Submit/list exist. | `leads:setHandled` exists. | No mark-handled UI found. | Add lead status handling or remove handled-state backend surface. |
| Wizard | UI and backend exist. | Wizard compute/mirror/odds chain exists. | Admin correction and finished-match mirroring are sensitive; prior review noted edge cases. | Design should expose enough auditability to understand mirrored/manual picks. |
| Swiss/Parbaj | UI says automatic participation. | `swiss:setSwissProfile` still exists. | Product rule mismatch: opt-in/profile vs automatic. | Decide final rule and remove or hide obsolete profile controls. |
| Push notifications | Client subscribe/local scheduling exists. | Push actions and subscription store exist. | Root relocation SW unregisters local scheduled notifications; canonical SW behavior must be verified. | Redesign notification setup around the canonical service worker only. |
| LiveScore/API polling | Admin manual controls exist. | Cron pollers, cache, locks, and match map exist. | Manual client API path should not become a normal user workflow. | Put API health/manual refresh in admin diagnostics only. |
| Import/export | Legacy JSON import/export exists. | `migrate:importAll` exists. | Broad import can overwrite state; risky in live game. | Redesign as backup, dry-run, diff, confirm, restore-point flow. |
| Privacy | UI exposes player history and global state. | `game:state` returns broad prediction/Wizard data. | If redesign wants hidden pre-kickoff predictions, backend state contract must change. | Decide privacy rules before screen design. |
| EN language | Next has EN pages/copy. | Convex supports community filtering. | Legacy EN path references `locales/en.json`; file not found in current inventory. | Decide whether EN is shipped, dormant, or Next-only. |
| Database rewrite | Drizzle/Neon scaffold exists. | Convex schema remains active source. | User says database stays; docs mention Neon/Supabase path. | Treat current schema/data as the stable domain contract until explicitly changed. |

## D. Functions That Are Or Should Be On The Site

### Public / Player

| Function | Must exist in redesign | Notes |
|---|---:|---|
| Public landing with language switch | Yes | Keep focused on entering the actual game; no marketing-only dead end. |
| Player selection and PIN login | Yes | Include clear wrong-PIN/loading/offline states. |
| Optional biometric unlock | Yes | Present as local convenience, not account security replacement. |
| Main navigation | Yes | Tabs/views: leaderboard, predictions, Wizard, Swiss/Parbaj, matches, groups/bracket, profile, about/rules. |
| Leaderboard with filters | Yes | Overall, group/knockout scopes, private leagues if configured, Wizard/Swiss summaries. |
| Player history modal/page | Yes | Include privacy rule for future/past predictions. |
| Prediction entry | Yes | Score steppers, lock state, saved state, kickoff countdown, result state. |
| Favorite team selection | Yes | Make scoring impact visible but not over-explained. |
| Wizard pick entry | Yes | 1/X/2 controls, odds, lock states, mirror status, leaderboard. |
| Swiss/Parbaj view | Yes | Current round, opponent, standings, archive, rule status. |
| Match centre | Yes | Live, recent, upcoming, archive, match detail with events/lineups where available. |
| Groups and knockout bracket | Yes | Bracket needs stable layout on mobile. |
| Profile and settings | Yes | PIN change, notifications, favorite, biometric setup, cache/reset, personal stats. |
| Push notifications | Yes | Permission, subscription state, test/disable, kickoff/result/bonus categories. |
| Offline/stale data state | Yes | Show last updated, retry, and stale-state warnings without blocking read-only use. |

### Admin / Operations

| Function | Must exist in redesign | Notes |
|---|---:|---|
| Admin PIN/TOTP/biometric login | Yes | Do not store admin PIN persistently. |
| Player management | Yes | Add/edit/rename/delete/restore, player PINs, private league assignment. |
| League/settings management | Yes | Admin PIN, player labels, private leagues, API settings. |
| Manual result entry/clear | Yes | Strong confirmation and visible recompute status. |
| KO team management | Yes | Keep bracket-derived values visible; manual override should be obvious. |
| Manual prediction override | Yes | Show audit trail and recompute impact. |
| Bonus points | Yes | Award/remove/diff/audit. |
| Swiss admin | Yes | Suggest/publish pairings, start, reshuffle, remove/restore players. |
| LiveScore diagnostics | Yes | API health, last poll, cache freshness, manual refresh as emergency control. |
| Transaction log and rollback | Yes | Make rollback support limits explicit. |
| Deleted-player restore | Yes | Show retention window and what will be restored. |
| Health/version/db stats | Yes | Include deploy version, state freshness, table counts, cron health. |
| Interest leads | Yes | Add mark handled/archive or remove the backend handled flag. |
| Export/import/restore | Yes, but redesigned | Replace raw import with dry-run, diff, confirmation, and backup timestamp. |

## E. Claude Design Brief: Required Inputs And Constraints

Give Claude Design the following checklist, not just a vague "make it nicer" instruction.

1. Product identity
   - Product name: Tomifoci.
   - Domain: small-group World Cup 2026 tipping game.
   - Audience: around 35 friends plus one/few admins.
   - Tone: fast, trusted, game-day operational, not SaaS marketing.

2. Fixed domain model
   - Preserve current entities: players, predictions, results, KO teams, bonuses, favorites, rankings, API cache, push subscriptions, Wizard, Swiss/Parbaj, PIN hashes, admin auth, deleted players, interest leads.
   - The database/data model stays unless a separate backend migration explicitly changes it.
   - Design should not invent new account objects, payments, teams, or social graphs unless requested.

3. Required information architecture
   - Public: landing, login.
   - Player app: dashboard/leaderboard, predictions, Wizard, Swiss/Parbaj, matches, groups/bracket, profile, about/rules.
   - Admin: secure dashboard, players/leagues/settings, results/KO, predictions override, bonuses, Swiss admin, API/health, txn rollback, restore, leads, import/export.

4. State and feedback requirements
   - Loading, empty, offline, stale-data, backend unavailable, wrong PIN, locked match, saved, unsaved, recomputing, push permission denied, and service-worker update states.
   - Show "last updated" or cache freshness where data can be stale.
   - Avoid hiding admin-destructive actions behind ambiguous icon-only controls.

5. Mobile-first game-day constraints
   - Prediction steppers must be thumb-friendly.
   - Bracket and match lists must remain readable on small screens.
   - Admin forms can be dense but must not collapse into error-prone tiny controls.
   - Text must not overflow buttons/cards; stable dimensions for score tiles, match cards, tabs, and steppers.

6. Visual design constraints
   - Build the real app as the first screen after login, not a marketing site.
   - Use the existing brand assets: `logo.png`, `wizard_logo.png`, `swiss.png`, `favicon.svg`.
   - Avoid a one-color theme. Football/game-day energy is useful, but admin screens should be calmer and more operational.
   - Use icons for repeated tools and compact actions, with labels/tooltips where ambiguity matters.
   - Cards should frame repeated items only; avoid cards nested inside cards.

7. Backend contract constraints
   - The primary player read model is currently `game:state`.
   - Mutations should be grouped into explicit interfaces: auth, predictions, favorites, results, admin settings, Wizard, Swiss, notifications, health, import/export.
   - Do not design screens that require backend functions not listed here without marking them as new backend work.
   - If privacy should change, define the exact new state contract before designing player history/leaderboard details.

8. Admin safety constraints
   - Admin screens need confirmation for result changes, KO overrides, import, delete, restore, rollback, and bonus removal.
   - Every admin write should have an audit trail or visible last action.
   - Manual API polling is diagnostic/emergency, not the main user flow.

9. Migration constraints
   - Existing players may have old service workers, offline backups, and local PIN/biometric markers.
   - A redesign must include a route/update strategy for `index.html`, `/classic/index.html`, `/login`, `/en`, and notification click-through.
   - Decide whether legacy static app stays as fallback during rollout.

10. Open decisions Claude Design must ask/resolve
    - Is final stack Next + existing Convex, Next + migrated DB, or vanilla JS + Convex refreshed UI?
    - Is EN launched now, later, or removed from active UI?
    - Are pre-kickoff predictions private or visible through global state/player history?
    - Is Swiss/Parbaj automatic participation final?
    - Should Wizard profile/join remain a user choice?
    - What is the canonical route after login?
    - Which admin functions are founder-only versus safe for delegated admins?
    - What restore/import safeguards are mandatory?

## Backend Redesign Notes

If the backend is rewritten while the database stays, the clean interface split should be:

- `AuthInterface`: player/admin PIN, TOTP, WebAuthn registration metadata if retained.
- `StateInterface`: stable player state read model with explicit privacy filtering.
- `PredictionInterface`: player prediction save, admin override, lock validation.
- `ScoringInterface`: result writes, recompute, rankings, bonus/favorite scoring.
- `TournamentInterface`: match schedule, KO team resolution, bracket, groups.
- `WizardInterface`: profile, picks, odds snapshots, mirror/backfill, rankings.
- `SwissInterface`: pairings, rounds, removals/restores, standings.
- `NotificationInterface`: subscriptions, push sends, local schedule metadata.
- `AdminOpsInterface`: settings, player lifecycle, transaction log, rollback, deleted-player restore, diagnostics.
- `IntegrationInterface`: LiveScore polling, cache freshness, match mapping, health.
- `MigrationInterface`: export, dry-run import, diff, confirmed restore.

Priority backend cleanup before redesign implementation:

1. Define the canonical `game:state` replacement/read model and privacy policy.
2. Replace legacy `fbSet` path-string writes with typed command functions.
3. Decide whether bulk raw import remains allowed.
4. Make admin rollback support explicit by transaction type.
5. Resolve the stack conflict in docs before assigning frontend design work.


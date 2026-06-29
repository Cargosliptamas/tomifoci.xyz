#!/usr/bin/env node
// Convex → Neon migration-drift detector.
//
// The classic game is still live on Convex while the new app runs on Neon. This script
// flags any truth data that exists on Convex but is missing (or differs) in Neon — i.e.
// data we failed to migrate or that was written to the old backend after cutover.
//
// Exit codes: 0 = no drift, 1 = drift detected, 2 = could not run (config/network).
//
// Usage: DATABASE_URL=postgres://... node scripts/check-convex-drift.mjs
// Env:   CONVEX_URL (optional, defaults to the known deployment)

import { neon } from '@neondatabase/serverless'

const CONVEX_URL = process.env.CONVEX_URL || 'https://adept-roadrunner-530.eu-west-1.convex.cloud'
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set')
  process.exit(2)
}

async function convexState(community) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'game:state', args: community ? { community } : {}, format: 'json' })
  })
  if (!res.ok) throw new Error(`Convex HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== 'success') throw new Error(`Convex query failed: ${json.errorMessage ?? 'unknown'}`)
  return json.value
}

function predictionCount(state) {
  return Object.values(state.predictions ?? {}).reduce((n, m) => n + Object.keys(m).length, 0)
}
function bonusCount(state) {
  return Object.values(state.bonuses ?? {}).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0)
}
function wizardPickCount(state) {
  return Object.values(state.wizardPicks ?? {}).reduce((n, m) => n + Object.keys(m).length, 0)
}

const sql = neon(DATABASE_URL)

let cvx
try {
  cvx = await convexState()
} catch (e) {
  console.error(`✗ Could not fetch Convex state: ${e.message}`)
  process.exit(2)
}

// ── Neon counts ───────────────────────────────────────────────────────────────
// Each entity is counted in the SAME unit as the Convex side:
//  - predictions / results: native tables, one row each
//  - favorites / bonuses: one imported_rows row per entity
//  - wizardPicks: Neon stores one row PER PLAYER (payload = {matchId: pick}); to compare
//    against Convex's per-pick total we sum the pick keys across those player-rows.
const [[pred], [res], favRows, bonRows, neonResults, wizPayloads] = await Promise.all([
  sql`SELECT COUNT(*)::int n FROM predictions WHERE community = 'hu'`,
  sql`SELECT COUNT(*)::int n FROM results`,
  sql`SELECT COUNT(*)::int n FROM imported_rows WHERE table_name = 'favorites'`,
  sql`SELECT COUNT(*)::int n FROM imported_rows WHERE table_name = 'bonuses'`,
  sql`SELECT match_id, h, a FROM results`,
  sql`SELECT payload FROM imported_rows WHERE table_name = 'wizardPicks'`
])

const neonWizardPicks = wizPayloads.reduce((n, r) => {
  const p = r.payload && typeof r.payload === 'object' ? r.payload : {}
  // payload is either {matchId: pick} (per-player row) or a single {player,matchId,pick}
  return n + (('player' in p || 'matchId' in p) ? 1 : Object.keys(p).length)
}, 0)

const neonCounts = {
  predictions: pred.n,
  results: res.n,
  favorites: favRows[0].n,
  wizardPicks: neonWizardPicks,
  bonuses: bonRows[0].n
}
const convex = {
  predictions: predictionCount(cvx),
  results: Object.keys(cvx.results ?? {}).length,
  favorites: Object.keys(cvx.favorites ?? {}).length,
  wizardPicks: wizardPickCount(cvx),
  bonuses: bonusCount(cvx)
}

// ── Count drift: Convex > Neon means un-migrated data (Neon > Convex is fine: new app writes) ──
let drift = false
console.log('entity        convex   neon   status')
console.log('────────────────────────────────────')
for (const key of Object.keys(convex)) {
  const c = convex[key]
  const n = neonCounts[key]
  const missing = Math.max(0, c - n)
  const status = missing > 0 ? `⚠️  ${missing} on Convex not in Neon` : 'ok'
  if (missing > 0) drift = true
  console.log(`${key.padEnd(13)} ${String(c).padStart(6)} ${String(n).padStart(6)}   ${status}`)
}

// ── Results key-level diff (most critical truth table; result keys are plain match ids) ──
const neonByMatch = new Map(neonResults.map((r) => [Number(r.match_id), { h: r.h, a: r.a }]))
const missingResults = []
const divergedResults = []
for (const [mid, r] of Object.entries(cvx.results ?? {})) {
  const id = Number(mid)
  const nr = neonByMatch.get(id)
  if (!nr) missingResults.push(id)
  else if (nr.h !== r.h || nr.a !== r.a) divergedResults.push({ id, convex: `${r.h}:${r.a}`, neon: `${nr.h}:${nr.a}` })
}
if (missingResults.length) {
  drift = true
  console.log(`\n⚠️  Results on Convex missing from Neon: ${missingResults.join(', ')}`)
}
if (divergedResults.length) {
  drift = true
  console.log(`\n⚠️  Results that differ (Convex vs Neon):`)
  for (const d of divergedResults) console.log(`     #${d.id}: convex ${d.convex} ≠ neon ${d.neon}`)
}

if (drift) {
  console.log('\n✗ DRIFT DETECTED — data on Convex is missing or differs in Neon. Re-run the migration.')
  process.exit(1)
}
console.log('\n✓ No drift — Neon has everything Convex has.')
process.exit(0)

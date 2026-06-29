#!/usr/bin/env node
// Incremental Convex → Neon sync. Closes the drift the checker reports, WITHOUT deleting
// anything (merge-upsert only — INV-01/INV-11). Safe to run repeatedly.
//
// Default is a DRY RUN (no writes). Pass --apply to actually write.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/sync-from-convex.mjs            # dry run
//   DATABASE_URL=postgres://... node scripts/sync-from-convex.mjs --apply    # write
//
// Scope: predictions + results + favorites (the core truth tables most prone to drift).
// Wizard picks are intentionally excluded — their Neon row shape needs a separate fix.

import { neon } from '@neondatabase/serverless'

const APPLY = process.argv.includes('--apply')
const CONVEX_URL = process.env.CONVEX_URL || 'https://adept-roadrunner-530.eu-west-1.convex.cloud'
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set')
  process.exit(2)
}

function decodeKey(k) {
  if (typeof k === 'string' && k.startsWith('q_')) {
    const bytes = (k.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
    return new TextDecoder().decode(new Uint8Array(bytes))
  }
  return k
}

const res = await fetch(`${CONVEX_URL}/api/query`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path: 'game:state', args: {}, format: 'json' })
})
const json = await res.json()
if (json.status !== 'success') {
  console.error('✗ Convex query failed')
  process.exit(2)
}
const st = json.value
const sql = neon(DATABASE_URL)

console.log(APPLY ? '── APPLY (writing) ──' : '── DRY RUN (no writes; pass --apply to write) ──')

// ── Predictions ────────────────────────────────────────────────────────────────
const existing = await sql`SELECT player, match_id, h, a FROM predictions WHERE community = 'hu'`
const have = new Map(existing.map((r) => [`${r.player}::${r.match_id}`, { h: r.h, a: r.a }]))
let predNew = 0
let predChanged = 0
const predWrites = []
for (const [owner, byMatch] of Object.entries(st.predictions ?? {})) {
  const player = decodeKey(owner)
  for (const [mid, p] of Object.entries(byMatch)) {
    const key = `${player}::${mid}`
    const cur = have.get(key)
    if (!cur) {
      predNew++
      predWrites.push({ player, mid: Number(mid), h: p.h, a: p.a })
    } else if (cur.h !== p.h || cur.a !== p.a) {
      predChanged++
      predWrites.push({ player, mid: Number(mid), h: p.h, a: p.a })
    }
  }
}
console.log(`predictions: ${predNew} new, ${predChanged} changed`)
if (APPLY) {
  for (const w of predWrites) {
    await sql`
      INSERT INTO predictions (player, match_id, h, a, community)
      VALUES (${w.player}, ${w.mid}, ${w.h}, ${w.a}, 'hu')
      ON CONFLICT (player, match_id, community) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
    `
  }
}

// ── Results (merge-upsert) ──────────────────────────────────────────────────────
const existR = await sql`SELECT match_id, h, a FROM results`
const haveR = new Map(existR.map((r) => [Number(r.match_id), { h: r.h, a: r.a }]))
let resNew = 0
let resChanged = 0
const resWrites = []
for (const [mid, r] of Object.entries(st.results ?? {})) {
  const id = Number(mid)
  const cur = haveR.get(id)
  if (!cur) {
    resNew++
    resWrites.push({ id, h: r.h, a: r.a })
  } else if (cur.h !== r.h || cur.a !== r.a) {
    resChanged++
    resWrites.push({ id, h: r.h, a: r.a })
  }
}
console.log(`results: ${resNew} new, ${resChanged} changed`)
if (APPLY) {
  for (const w of resWrites) {
    await sql`
      INSERT INTO results (match_id, h, a)
      VALUES (${w.id}, ${w.h}, ${w.a})
      ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
    `
  }
}

// ── Favorites (upsert by player) ────────────────────────────────────────────────
let favWrites = 0
for (const [owner, fav] of Object.entries(st.favorites ?? {})) {
  const player = decodeKey(owner)
  const rows = await sql`SELECT id FROM imported_rows WHERE table_name='favorites' AND convex_id=${`hu:${player}`}`
  if (!rows.length) {
    favWrites++
    if (APPLY) {
      await sql`
        INSERT INTO imported_rows (table_name, convex_id, payload)
        VALUES ('favorites', ${`hu:${player}`}, ${JSON.stringify({ player, community: 'hu', ...fav })}::jsonb)
        ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
      `
    }
  }
}
console.log(`favorites: ${favWrites} new`)

console.log(APPLY ? '\n✓ Sync applied.' : '\nDry run complete — re-run with --apply to write these changes.')

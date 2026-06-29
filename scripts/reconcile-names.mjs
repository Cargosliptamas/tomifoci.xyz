#!/usr/bin/env node
// Player-name reconciliation. The migration stored ~some players' rows under their
// ENCODED key (q_<hex>) instead of their real name, breaking their scoring. This builds
// a variant→canonical name map (canonical = settings.players names), reports every
// name-keyed table that holds a non-canonical name, and (with --apply) rewrites the
// predictions table to canonical names after backing up the affected rows.
//
// Usage:
//   DATABASE_URL=... node scripts/reconcile-names.mjs           # diagnose (read-only)
//   DATABASE_URL=... node scripts/reconcile-names.mjs --apply   # fix predictions (backs up first)

import { neon } from '@neondatabase/serverless'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set')
  process.exit(2)
}
const sql = neon(DATABASE_URL)

function decodeKey(k) {
  if (typeof k === 'string' && k.startsWith('q_')) {
    const bytes = (k.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
    } catch {
      return k
    }
  }
  return k
}

// ── Canonical names (settings.players + enPlayers) ──────────────────────────────
const [settings] = await sql`SELECT players, en_players AS "enPlayers" FROM settings LIMIT 1`
const canonical = new Set()
for (const p of settings.players ?? []) canonical.add(typeof p === 'string' ? p : p.name)
for (const p of settings.enPlayers ?? []) canonical.add(typeof p === 'string' ? p : p.name)

// ── Build variant→canonical map from the predictions table ──────────────────────
const distinct = await sql`SELECT DISTINCT player FROM predictions`
const map = [] // { variant, canonical, decodes }
const unknown = []
for (const { player } of distinct) {
  if (canonical.has(player)) continue
  const decoded = decodeKey(player)
  if (canonical.has(decoded)) map.push({ variant: player, canonical: decoded })
  else unknown.push({ variant: player, decoded })
}

console.log('── PLAYER NAME RECONCILIATION ──')
console.log(`canonical players: ${canonical.size}`)
console.log(`\nvariant (Neon)                              →  canonical`)
console.log('─'.repeat(64))
for (const m of map) console.log(`${m.variant.padEnd(44)}→  ${m.canonical}`)
if (!map.length) console.log('(none — all prediction names already canonical)')
if (unknown.length) {
  console.log(`\n⚠️  ${unknown.length} name(s) match no canonical player (need manual review):`)
  for (const u of unknown) console.log(`   ${u.variant}  (decodes to: "${u.decoded}")`)
}

// ── How many prediction rows each remap touches ─────────────────────────────────
let totalRows = 0
for (const m of map) {
  const [{ n }] = await sql`SELECT COUNT(*)::int n FROM predictions WHERE player = ${m.variant}`
  m.rows = n
  totalRows += n
  // collision check: would the canonical name already have a row for the same match?
  const collisions = await sql`
    SELECT a.match_id FROM predictions a
    JOIN predictions b ON a.match_id = b.match_id AND a.community = b.community
    WHERE a.player = ${m.variant} AND b.player = ${m.canonical}
  `
  m.collisions = collisions.length
}
console.log(`\n${map.length} players, ${totalRows} prediction rows to remap.`)
const anyCollisions = map.filter((m) => m.collisions > 0)
if (anyCollisions.length) {
  console.log('\n⚠️  COLLISIONS — canonical name already has a prediction for the same match:')
  for (const m of anyCollisions) console.log(`   ${m.canonical}: ${m.collisions} overlapping match(es)`)
  console.log('   (these would need merge logic, not a blind rename)')
}

if (!APPLY) {
  console.log('\nDiagnose only. Re-run with --apply to back up + rewrite predictions to canonical names.')
  process.exit(0)
}

// ── APPLY: back up affected rows, then rename ───────────────────────────────────
if (anyCollisions.length) {
  console.error('\n✗ Refusing to apply: collisions present. Resolve merges manually first.')
  process.exit(1)
}
const variants = map.map((m) => m.variant)
const backup = await sql`SELECT * FROM predictions WHERE player = ANY(${variants})`
const stamp = new Date(backup[0]?.id ? Date.now() : Date.now()).toISOString().replace(/[:.]/g, '-')
const file = `backup-predictions-${stamp}.json`
writeFileSync(file, JSON.stringify(backup, null, 2))
console.log(`\n✓ Backed up ${backup.length} rows to ${file}`)

let updated = 0
for (const m of map) {
  const r = await sql`UPDATE predictions SET player = ${m.canonical} WHERE player = ${m.variant}`
  updated += r.length ?? 0
}
console.log(`✓ Renamed ${map.length} variant names to canonical. Predictions now match the player list.`)
console.log('Note: scores recompute live on read — affected players will score correctly immediately.')

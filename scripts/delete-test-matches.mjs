#!/usr/bin/env node
// Delete test/friendly match data (match_id >= 999) from the `predictions` and `results`
// tables, KEEPING the three Hungary easter-egg matches:
//   1004 = Magyarország–Olaszország (VB-elődöntő / R4)
//   1005 = Magyarország–Brazília    (VB-negyeddöntő / R8)
//   1006 = Magyarország–Argentína   (VB-R16)
//
// SAFE BY DEFAULT: a dry run that reports what it would delete and writes a JSON backup,
// but deletes NOTHING. Pass --execute to actually delete (a backup is still written first).
//
//   node scripts/delete-test-matches.mjs              # dry run + backup
//   node scripts/delete-test-matches.mjs --execute    # delete (after backup)
//
// DATABASE_URL is read from the environment or from .env.local / .env. For production,
// pull it first (e.g. `vercel env pull .env.local`) or pass it inline:
//   DATABASE_URL="postgres://…" node scripts/delete-test-matches.mjs

import { neon } from '@neondatabase/serverless'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const KEEP = [1004, 1005, 1006] // Hungary easter eggs — never delete
const THRESHOLD = 999 // ids >= this are test/friendly matches
const EXECUTE = process.argv.includes('--execute')

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/)
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

const url = loadDatabaseUrl()
if (!url) {
  console.error('✗ DATABASE_URL not found (checked env, .env.local, .env).')
  console.error('  Pull it with `vercel env pull .env.local`, or pass it inline:')
  console.error('  DATABASE_URL="postgres://…" node scripts/delete-test-matches.mjs')
  process.exit(1)
}

const sql = neon(url)

const preds = await sql`
  SELECT player, match_id, h, a, community FROM predictions
  WHERE match_id >= ${THRESHOLD} AND match_id <> ALL(${KEEP})
  ORDER BY match_id, player`
const results = await sql`
  SELECT match_id, h, a, pen_h, pen_a FROM results
  WHERE match_id >= ${THRESHOLD} AND match_id <> ALL(${KEEP})
  ORDER BY match_id`

const byId = {}
for (const r of preds) (byId[r.match_id] ??= { preds: 0, result: false }).preds++
for (const r of results) (byId[r.match_id] ??= { preds: 0, result: false }).result = true

const ids = Object.keys(byId).map(Number).sort((a, b) => a - b)
console.log(`\nTest-match data to delete (match_id >= ${THRESHOLD}, keeping eggs ${KEEP.join(', ')}):`)
if (!ids.length) console.log('  (none — nothing to delete)')
for (const id of ids) console.log(`  match ${id}: ${byId[id].preds} prediction(s)${byId[id].result ? ', 1 result' : ''}`)
console.log(`\nTotals: ${preds.length} prediction rows, ${results.length} result rows across ${ids.length} match(es).`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupFile = `backup-test-matches-${stamp}.json`
writeFileSync(backupFile, JSON.stringify({ keptEggs: KEEP, predictions: preds, results }, null, 2))
console.log(`Backup written → ${backupFile}`)

if (!EXECUTE) {
  console.log('\nDRY RUN — no rows deleted. Re-run with --execute to delete.')
  process.exit(0)
}

await sql`DELETE FROM predictions WHERE match_id >= ${THRESHOLD} AND match_id <> ALL(${KEEP})`
await sql`DELETE FROM results WHERE match_id >= ${THRESHOLD} AND match_id <> ALL(${KEEP})`
console.log(`\n✓ Deleted ${preds.length} prediction rows and ${results.length} result rows.`)

const remain = await sql`
  SELECT DISTINCT match_id FROM predictions
  WHERE match_id >= ${THRESHOLD} AND match_id <> ALL(${KEEP})
  ORDER BY match_id`
console.log(
  remain.length
    ? `⚠ Remaining test predictions: ${remain.map((r) => r.match_id).join(', ')}`
    : '✓ No non-egg test predictions remain (eggs 1004/1005/1006 preserved).'
)

#!/usr/bin/env node
// Neon write-health check. Proves the results write path works end-to-end:
// upsert a sentinel result → read it back → verify → delete it. Confirms admin result
// entry would succeed, without touching any real match.
//
// Exit codes: 0 = healthy, 1 = write/read/delete failed, 2 = config error.
//
// Usage: DATABASE_URL=postgres://... node scripts/check-write-health.mjs

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set')
  process.exit(2)
}

const sql = neon(DATABASE_URL)
const SENTINEL_ID = 990099 // far outside the real fixture id space
const h = Math.floor((Date.now() / 1000) % 7) // vary so we detect stale/no-op writes
const a = (h + 1) % 7

async function main() {
  // Ensure clean start
  await sql`DELETE FROM results WHERE match_id = ${SENTINEL_ID}`

  // Write (same merge-upsert path the admin route uses — INV-11)
  await sql`
    INSERT INTO results (match_id, h, a)
    VALUES (${SENTINEL_ID}, ${h}, ${a})
    ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
  `

  // Read back
  const rows = await sql`SELECT h, a FROM results WHERE match_id = ${SENTINEL_ID}`
  const got = rows[0]
  if (!got) throw new Error('sentinel result not found after write')
  if (got.h !== h || got.a !== a) throw new Error(`read-back mismatch: wrote ${h}:${a}, got ${got.h}:${got.a}`)

  // Update-in-place (verify upsert path too)
  await sql`
    INSERT INTO results (match_id, h, a)
    VALUES (${SENTINEL_ID}, ${h + 1}, ${a})
    ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
  `
  const rows2 = await sql`SELECT h FROM results WHERE match_id = ${SENTINEL_ID}`
  if (rows2[0]?.h !== h + 1) throw new Error('upsert update did not take effect')

  // Cleanup
  await sql`DELETE FROM results WHERE match_id = ${SENTINEL_ID}`
  const leftover = await sql`SELECT COUNT(*)::int n FROM results WHERE match_id = ${SENTINEL_ID}`
  if (leftover[0].n !== 0) throw new Error('cleanup failed — sentinel still present')
}

const start = Date.now()
main()
  .then(() => {
    console.log(`✓ Neon write-health OK — insert, read-back, upsert and delete all succeeded (${Date.now() - start}ms)`)
    process.exit(0)
  })
  .catch(async (e) => {
    // best-effort cleanup so a failure never leaves a sentinel behind
    try {
      await sql`DELETE FROM results WHERE match_id = ${SENTINEL_ID}`
    } catch {}
    console.error(`✗ Neon write-health FAILED: ${e.message}`)
    process.exit(1)
  })

// One-off fix: result corrections + R16 bracket seed
// Run: vercel env pull .env.local && node --env-file=.env.local scripts/fix-results-bracket.mjs
//
// What this does:
//   1. Fix match 76 result (Netherlands 1-1 Morocco AET, stored wrong as 0:2)
//   2. Add penalty results for match 75 (Germany 3-4 Paraguay) and 76 (Netherlands 2-3 Morocco)
//   3. Clear phantom results for matches 77, 78, 80 (future matches not yet played)
//   4. Seed R16 koTeams for match 89 (Kanada vs Brazília) and 90 (Paraguay vs Marokkó)

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function currentResult(matchId) {
  const rows = await sql`SELECT match_id, h, a, pen_h, pen_a FROM results WHERE match_id = ${matchId}`
  return rows[0] ?? null
}

async function main() {
  console.log('=== fix-results-bracket.mjs ===\n')

  // ── 1. Fix match 76 FT result + add penalty result ─────────────────────────
  // Actual: Netherlands 1-1 Morocco AET; Morocco wins 3-2 on penalties
  // Stored: h=0, a=2 (WRONG)
  const r76before = await currentResult(76)
  console.log(`Match 76 before: ${JSON.stringify(r76before)}`)
  await sql`
    INSERT INTO results (match_id, h, a, pen_h, pen_a)
    VALUES (76, 1, 1, 2, 3)
    ON CONFLICT (match_id) DO UPDATE SET h = 1, a = 1, pen_h = 2, pen_a = 3
  `
  console.log('✓ Match 76: h=1, a=1, pen_h=2, pen_a=3 (Morocco wins on pens)\n')

  // ── 2. Add penalty result for match 75 (FT already correct at 1:1) ─────────
  // Actual: Germany 1-1 Paraguay AET; Paraguay wins 4-3 on penalties
  const r75before = await currentResult(75)
  console.log(`Match 75 before: ${JSON.stringify(r75before)}`)
  await sql`
    INSERT INTO results (match_id, h, a, pen_h, pen_a)
    VALUES (75, 1, 1, 3, 4)
    ON CONFLICT (match_id) DO UPDATE SET pen_h = 3, pen_a = 4
  `
  console.log('✓ Match 75: pen_h=3, pen_a=4 (Paraguay wins on pens)\n')

  // ── 3. Clear phantom results for future matches ─────────────────────────────
  // Match 77: Elefántcsontpart vs Norvégia, kicks off 2026-06-30T19:00+02:00
  // Match 78: Franciaország vs Svédország,  kicks off 2026-06-30T23:00+02:00
  // Match 80: Anglia vs Kongói DK,          kicks off 2026-07-01T18:00+02:00
  for (const matchId of [77, 78, 80]) {
    const before = await currentResult(matchId)
    if (before) {
      await sql`DELETE FROM results WHERE match_id = ${matchId}`
      console.log(`✓ Match ${matchId}: cleared phantom result ${before.h}:${before.a}`)
    } else {
      console.log(`  Match ${matchId}: no phantom result found`)
    }
  }

  // ── 4. Seed R16 koTeams ─────────────────────────────────────────────────────
  // Match 89 (2026-07-04T19:00): Winner M73 (Kanada) vs Winner M74 (Brazília)
  // Match 90 (2026-07-04T23:00): Winner M75 (Paraguay) vs Winner M76 (Marokkó)
  const r16 = [
    { id: '89', home: 'Kanada',   away: 'Brazília', note: 'Winner M73 vs Winner M74' },
    { id: '90', home: 'Paraguay', away: 'Marokkó',  note: 'Winner M75 vs Winner M76' },
  ]
  console.log()
  for (const m of r16) {
    const existing = await sql`
      SELECT payload FROM imported_rows WHERE table_name = 'koTeams' AND convex_id = ${m.id} LIMIT 1
    `
    const prev = existing[0]?.payload ?? null
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('koTeams', ${m.id}, ${JSON.stringify({ home: m.home, away: m.away, confirmed: true })}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
    const prevStr = prev ? `${prev.home} vs ${prev.away}` : 'empty'
    console.log(`✓ Match ${m.id} (R16): ${m.home} vs ${m.away}  [was: ${prevStr}]  (${m.note})`)
  }

  console.log('\n=== Done ===')
  console.log('Reminder: trigger a manual cron poll via POST /api/admin/poll to refresh livescore state')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

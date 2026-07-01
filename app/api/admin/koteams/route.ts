import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin endpoint: write or clear a KO match team assignment.
// POST { matchId, home, away }              → upsert koTeams entry
// POST { matchId, home, away, confirmed }   → mark as manually verified (cron won't overwrite)
// POST { matchId, action: 'clear' }         → remove the koTeams entry

export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  let body: { matchId?: number; home?: string; away?: string; confirmed?: boolean; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const matchId = Number(body.matchId)
  if (!Number.isInteger(matchId) || matchId < 73 || matchId > 104) {
    return NextResponse.json({ ok: false, error: 'bad-match-id (must be 73–104)' }, { status: 400 })
  }

  const sql = getSql()

  if (body.action === 'clear') {
    await sql`
      DELETE FROM imported_rows WHERE table_name = 'koTeams' AND convex_id = ${String(matchId)}
    `
    await logTxn({
      type: 'ko_team_clear',
      label: `KO párosítás törölve: #${matchId}`,
      path: 'koTeams',
      before: { matchId },
      after: null
    })
    return NextResponse.json({ ok: true, cleared: true })
  }

  const home = String(body.home ?? '').trim()
  const away = String(body.away ?? '').trim()
  if (!home || !away) {
    return NextResponse.json({ ok: false, error: 'home and away are required' }, { status: 400 })
  }

  const payload = { home, away, confirmed: body.confirmed !== false }
  await sql`
    INSERT INTO imported_rows (table_name, convex_id, payload)
    VALUES ('koTeams', ${String(matchId)}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
  `
  await logTxn({
    type: 'ko_team_set',
    label: `KO párosítás mentve: #${matchId} · ${home} – ${away}`,
    path: 'koTeams',
    before: null,
    after: { matchId, ...payload }
  })
  return NextResponse.json({ ok: true, matchId, home, away })
}

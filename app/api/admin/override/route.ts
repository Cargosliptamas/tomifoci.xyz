import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin manual prediction override: set a single player's prediction for a single
// match, bypassing the server-side kickoff lock (admin only — INV-10 applies to
// players, not admins). Merge-upsert into the predictions table, never delete-all
// (INV-11). The wizard mirror + all scores re-derive live on the next read, so no
// explicit recompute call is needed.

type Body = { player?: string; matchId?: number; h?: number; a?: number; community?: 'hu' | 'en' }

export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const player = String(body.player ?? '').trim()
  const matchId = Number(body.matchId)
  const h = Number(body.h)
  const a = Number(body.a)
  const community: 'hu' | 'en' = body.community === 'en' ? 'en' : 'hu'

  if (!player || !Number.isInteger(matchId)) {
    return NextResponse.json({ ok: false, error: 'bad-target' }, { status: 400 })
  }
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99) {
    return NextResponse.json({ ok: false, error: 'bad-score' }, { status: 400 })
  }

  const sql = getSql()
  try {
    const existing = (await sql`
      SELECT h, a FROM predictions WHERE player = ${player} AND match_id = ${matchId} AND community = ${community}
    `) as Array<{ h: number; a: number }>
    const before = existing[0] ? { player, matchId, h: existing[0].h, a: existing[0].a, community } : null

    // merge-upsert — never delete-all (INV-11), bypassing the kickoff lock.
    await sql`
      INSERT INTO predictions (player, match_id, h, a, community)
      VALUES (${player}, ${matchId}, ${h}, ${a}, ${community})
      ON CONFLICT (player, match_id, community) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
    `

    await logTxn({
      type: 'prediction',
      label: `Kézi tipp: ${player} #${matchId} ${h}:${a}`,
      who: community === 'en' ? 'admin_en' : 'admin',
      path: 'predictions',
      before,
      after: { player, matchId, h, a, community }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

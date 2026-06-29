import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn, importedRowsWithIds, deleteImportedRowById } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin bonus points — award / revoke. Bonuses are an additive history: each award
// is its own 'bonuses' imported row {player, pts, reason, community}. Revoke removes
// the row at the index the UI shows (the Nth bonus for that player, in insertion
// order — getImportedRows orders by id ASC, matching the admin list). Scores
// re-derive live on the next read.

type Body = {
  action?: 'award' | 'remove'
  player?: string
  pts?: number
  reason?: string
  index?: number
  community?: 'hu' | 'en'
}

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
  const community: 'hu' | 'en' = body.community === 'en' ? 'en' : 'hu'
  if (!player) return NextResponse.json({ ok: false, error: 'bad-player' }, { status: 400 })

  const sql = getSql()
  try {
    if (body.action === 'remove') {
      const index = Number(body.index)
      if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ ok: false, error: 'bad-index' }, { status: 400 })
      }
      // The Nth bonus row for this player+community, in the same id-ascending
      // order the admin list renders.
      const rows = (await importedRowsWithIds('bonuses')).filter(
        (row) => row.payload?.player === player && (row.payload?.community ?? 'hu') === community
      )
      const target = rows[index]
      if (!target) return NextResponse.json({ ok: false, error: 'bonus-not-found' }, { status: 404 })
      await deleteImportedRowById(target.id)
      await logTxn({
        type: 'bonus',
        label: `Bónusz visszavonva: ${player} (${target.payload?.pts ?? '?'})`,
        who: community === 'en' ? 'admin_en' : 'admin',
        path: 'bonuses',
        before: { pts: target.payload?.pts, reason: target.payload?.reason },
        after: null
      })
      return NextResponse.json({ ok: true })
    }

    // award (default)
    const pts = Number(body.pts)
    if (!Number.isInteger(pts) || Math.abs(pts) > 999) {
      return NextResponse.json({ ok: false, error: 'bad-pts' }, { status: 400 })
    }
    const reason = String(body.reason ?? '').trim() || 'Bónusz'
    const ts = Date.now()
    const payload = { player, pts, reason, community, ts }
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('bonuses', ${`${community}:${player}:${ts}:${crypto.randomUUID().slice(0, 6)}`}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (table_name, convex_id) DO NOTHING
    `
    await logTxn({
      type: 'bonus',
      label: `Bónusz: ${player} ${pts >= 0 ? '+' : ''}${pts} ${reason}`,
      who: community === 'en' ? 'admin_en' : 'admin',
      path: 'bonuses',
      before: null,
      after: { pts, reason }
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

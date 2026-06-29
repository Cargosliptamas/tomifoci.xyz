import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { logTxn } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin result upsert / clear. Guarded by ADMIN_TOKEN (set in Vercel env). Until the
// adminAuth table is seeded in Neon, this token is the only thing protecting truth writes.
// Result writes are merge-upsert, never delete-all (INV-11).
function authorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  return request.headers.get('x-admin-token') === token
}

export async function POST(request: Request) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: 'admin-not-configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: { matchId?: number; h?: number; a?: number; penH?: number; penA?: number; action?: 'save' | 'clear' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const matchId = Number(body.matchId)
  if (!Number.isInteger(matchId)) return NextResponse.json({ ok: false, error: 'bad-match' }, { status: 400 })

  const sql = getSql()
  try {
    if (body.action === 'clear') {
      await sql`DELETE FROM results WHERE match_id = ${matchId}`
      await logTxn({ type: 'result', label: `Eredmény törölve: #${matchId}`, path: 'results', before: { matchId } })
      return NextResponse.json({ ok: true, cleared: true })
    }

    const h = Number(body.h)
    const a = Number(body.a)
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) {
      return NextResponse.json({ ok: false, error: 'bad-score' }, { status: 400 })
    }

    // Optional knockout penalty shootout score (pen_h/pen_a). Only meaningful for KO
    // matches; stored as NULL when absent or invalid so the result stays well-formed.
    const validPen = (v: unknown): number | null => {
      const n = Number(v)
      return v != null && Number.isInteger(n) && n >= 0 && n <= 30 ? n : null
    }
    const penH = validPen(body.penH)
    const penA = validPen(body.penA)

    // merge-upsert — never delete-all (INV-11)
    await sql`
      INSERT INTO results (match_id, h, a, pen_h, pen_a)
      VALUES (${matchId}, ${h}, ${a}, ${penH}, ${penA})
      ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a, pen_h = EXCLUDED.pen_h, pen_a = EXCLUDED.pen_a
    `
    const penNote = penH != null && penA != null ? ` (tizenegyesek ${penH}:${penA})` : ''
    await logTxn({
      type: 'result',
      label: `Eredmény mentve: #${matchId} ${h}:${a}${penNote}`,
      path: 'results',
      after: { matchId, h, a, penH, penA }
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

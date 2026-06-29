import { NextResponse } from 'next/server'
import { getSql, upsertImportedRow } from '@/lib/db'
import { fetchMatchCentre } from '@/lib/livescore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// Match-centre data (live events + lineups + odds) for ONE of our match ids.
// Resolves the match id → feed apiId by hu team-name pair (lib/livescore), then
// pulls single.json + scores/events.json. The processed payload is cached in
// imported_rows apiCache under kind=`events_<matchId>` with a ~60s TTL so the
// modal can be opened repeatedly without hammering the LiveScore API.
//
// Shape: { ok, events:[{minute,type,player,team:'h'|'a'}],
//          lineups:{home:[{num,name}],away:[...]}|null, odds:{h,x,a}|null, status }
// Always responds ok:true with empty data when LS is unconfigured or the match
// can't be resolved — never an error the modal has to handle.
const TTL_MS = 60_000

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const matchId = Number(id)
  const empty = { ok: true as const, events: [], lineups: null, odds: null, status: '' }
  if (!Number.isFinite(matchId)) {
    return NextResponse.json(empty)
  }

  try {
    const sql = getSql()
    const cacheKey = `events_${matchId}`
    const rows = await sql`
      SELECT payload FROM imported_rows
      WHERE table_name = 'apiCache' AND convex_id = ${cacheKey}
      LIMIT 1
    `
    const cached = (rows as Array<{ payload: any }>)[0]?.payload
    if (cached?.data && typeof cached.ts === 'number' && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json({ ok: true, ...cached.data, cached: true })
    }

    const data = await fetchMatchCentre(matchId)
    await upsertImportedRow('apiCache', cacheKey, { kind: cacheKey, ts: Date.now(), data })
    return NextResponse.json({ ok: true, ...data })
  } catch {
    // DB unavailable / unexpected — still degrade gracefully for the modal.
    return NextResponse.json(empty)
  }
}

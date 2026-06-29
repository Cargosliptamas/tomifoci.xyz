import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn, importedRowsWithIds } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin transaction log — read / rollback / clear(archive).
// Only PREDICTION-type txns are rollback-able: predictions are immutable truth
// (INV-01), so restoring the prior value (or deleting the row if there was none)
// fully reverses the write. Result/bonus/swiss rollbacks would need bespoke
// inverse logic and are intentionally not exposed here. Scores re-derive live.

type Body = { action?: 'read' | 'rollback' | 'clear'; ts?: number }

export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  try {
    switch (body.action) {
      case 'read':
        return await readLog()
      case 'rollback':
        return await rollback(Number(body.ts))
      case 'clear':
        return await clearLog()
      default:
        return NextResponse.json({ ok: false, error: 'bad-action' }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function readLog() {
  const rows = await importedRowsWithIds('txnlog')
  const log = rows
    .map((row) => ({
      ts: Number(row.payload?.ts ?? 0),
      who: row.payload?.who ?? 'admin',
      type: row.payload?.type ?? '',
      label: row.payload?.label ?? '',
      path: row.payload?.path ?? null
    }))
    .sort((a, b) => b.ts - a.ts)
  return NextResponse.json({ ok: true, log })
}

function predictionTargetFromTxn(payload: Record<string, any>) {
  const after = payload?.after ?? {}
  const before = payload?.before ?? {}
  const parsed = String(payload?.label ?? '').match(/^Kézi tipp: (.+) #(\d+) (\d+):(\d+)$/)
  const player = after.player ?? before.player ?? parsed?.[1]
  const matchId = after.matchId ?? before.matchId ?? (parsed ? Number(parsed[2]) : undefined)
  const community = after.community ?? before.community ?? 'hu'
  if (!player || !Number.isInteger(Number(matchId))) throw new Error('Ez a naplóbejegyzés nem tartalmaz elég adatot a visszavonáshoz')
  return { player: String(player), matchId: Number(matchId), community: community as 'hu' | 'en', before }
}

async function rollback(ts: number) {
  if (!Number.isInteger(ts)) return NextResponse.json({ ok: false, error: 'bad-ts' }, { status: 400 })
  const sql = getSql()

  const rows = await importedRowsWithIds('txnlog')
  const txn = rows.find((row) => Number(row.payload?.ts) === ts)
  if (!txn) return NextResponse.json({ ok: false, error: 'txn-not-found' }, { status: 404 })
  if (txn.payload?.type !== 'prediction') {
    return NextResponse.json({ ok: false, error: 'not-rollbackable' }, { status: 409 })
  }

  const target = predictionTargetFromTxn(txn.payload)
  const before = target.before && Object.keys(target.before).length ? target.before : null

  if (before && before.h != null && before.a != null) {
    // Restore the prior prediction (merge-upsert; never delete-all — INV-11).
    await sql`
      INSERT INTO predictions (player, match_id, h, a, community)
      VALUES (${target.player}, ${target.matchId}, ${Number(before.h)}, ${Number(before.a)}, ${target.community})
      ON CONFLICT (player, match_id, community) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
    `
  } else {
    // There was no prior prediction — the override created it, so remove it.
    await sql`DELETE FROM predictions WHERE player = ${target.player} AND match_id = ${target.matchId} AND community = ${target.community}`
  }

  await sql`DELETE FROM imported_rows WHERE id = ${txn.id}`
  await logTxn({
    type: 'prediction_rollback',
    label: `Kézi tipp visszavonva: ${target.player} #${target.matchId}`,
    who: target.community === 'en' ? 'admin_en' : 'admin',
    path: 'predictions',
    before: txn.payload?.after ?? null,
    after: before
  })
  return NextResponse.json({ ok: true })
}

async function clearLog() {
  const sql = getSql()
  const rows = await importedRowsWithIds('txnlog')
  if (rows.length) {
    // Archive the current log into a single timestamped archive row, then clear.
    const archivedAt = Date.now()
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('txnlogArchive', ${`${archivedAt}:${crypto.randomUUID().slice(0, 8)}`}, ${JSON.stringify({ archivedAt, entries: rows.map((r) => r.payload) })}::jsonb)
      ON CONFLICT (table_name, convex_id) DO NOTHING
    `
    await sql`DELETE FROM imported_rows WHERE table_name = 'txnlog'`
  }
  await logTxn({ type: 'log', label: 'Napló archiválva', path: 'txnlog' })
  return NextResponse.json({ ok: true, archived: rows.length })
}

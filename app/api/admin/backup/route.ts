import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin backup / restore.
//  • export  → the full raw game state (settings + predictions + results + every
//              imported_rows row), enough to rebuild the database. Derived tables
//              (scores/rankings/standings) are included as-is but re-derive on read.
//  • restore → two-phase. Without `confirm` it is a DRY RUN: nothing is written, a
//              diff summary (adds / changes per table) is returned. With `confirm`
//              the snapshot is applied as merge-upsert — never delete-all (INV-11),
//              so a stale backup can only add/overwrite rows, never erase live ones.

type RawState = {
  settings?: Record<string, any> | null
  predictions?: Array<Record<string, any>>
  results?: Array<Record<string, any>>
  importedRows?: Array<{ tableName: string; convexId: string | null; payload: Record<string, any> }>
}

type Body = { action?: 'export' | 'restore'; confirm?: boolean; data?: RawState; file?: string }

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
    if (body.action === 'export') return await exportState()
    if (body.action === 'restore') return await restoreState(body)
    return NextResponse.json({ ok: false, error: 'bad-action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function exportState() {
  const sql = getSql()
  const [settingsRows, predictions, results, importedRows] = await Promise.all([
    sql`SELECT * FROM settings ORDER BY id ASC LIMIT 1`,
    sql`SELECT player, match_id AS "matchId", h, a, community FROM predictions ORDER BY id ASC`,
    sql`SELECT match_id AS "matchId", h, a, pen_h AS "pen_h", pen_a AS "pen_a" FROM results ORDER BY id ASC`,
    sql`SELECT table_name AS "tableName", convex_id AS "convexId", payload FROM imported_rows ORDER BY id ASC`
  ])
  // INV-09: never emit the LS2 keys / admin TOTP, even in an admin backup.
  const rawSettings = (settingsRows[0] as Record<string, any>) ?? null
  let settings: Record<string, any> | null = null
  if (rawSettings) {
    const { ls2_key, ls2_secret, admin_totp, ...safe } = rawSettings
    void ls2_key
    void ls2_secret
    void admin_totp
    settings = safe
  }
  const state: RawState = {
    settings,
    predictions: predictions as Array<Record<string, any>>,
    results: results as Array<Record<string, any>>,
    importedRows: importedRows as RawState['importedRows']
  }
  return NextResponse.json({ ok: true, exportedAt: Date.now(), state })
}

async function restoreState(body: Body) {
  const data = body.data
  // The admin UI's file picker only transmits the filename, not the contents — so
  // a restore with no `data` is treated as an empty dry run (nothing to apply).
  if (!data || typeof data !== 'object') {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      summary: { note: 'no-data-supplied', predictions: 0, results: 0, importedRows: 0 },
      file: body.file ?? null
    })
  }

  const incomingPreds = Array.isArray(data.predictions) ? data.predictions : []
  const incomingResults = Array.isArray(data.results) ? data.results : []
  const incomingImported = Array.isArray(data.importedRows) ? data.importedRows : []

  const sql = getSql()

  // ── DRY RUN: compute a diff summary without writing. ──────────────────────
  if (!body.confirm) {
    const [existPreds, existResults, existImported] = await Promise.all([
      sql`SELECT player, match_id AS "matchId", h, a, community FROM predictions` as Promise<Array<Record<string, any>>>,
      sql`SELECT match_id AS "matchId", h, a FROM results` as Promise<Array<Record<string, any>>>,
      sql`SELECT table_name AS "tableName", convex_id AS "convexId" FROM imported_rows` as Promise<Array<Record<string, any>>>
    ])

    const predKey = (r: Record<string, any>) => `${r.player}|${r.matchId}|${r.community ?? 'hu'}`
    const existPredMap = new Map(existPreds.map((r) => [predKey(r), r]))
    let predAdd = 0
    let predChange = 0
    for (const r of incomingPreds) {
      const cur = existPredMap.get(predKey(r))
      if (!cur) predAdd++
      else if (Number(cur.h) !== Number(r.h) || Number(cur.a) !== Number(r.a)) predChange++
    }

    const existResMap = new Map(existResults.map((r) => [String(r.matchId), r]))
    let resAdd = 0
    let resChange = 0
    for (const r of incomingResults) {
      const cur = existResMap.get(String(r.matchId))
      if (!cur) resAdd++
      else if (Number(cur.h) !== Number(r.h) || Number(cur.a) !== Number(r.a)) resChange++
    }

    const existKeys = new Set(existImported.map((r) => `${r.tableName}|${r.convexId}`))
    let impAdd = 0
    let impExisting = 0
    for (const r of incomingImported) {
      if (existKeys.has(`${r.tableName}|${r.convexId}`)) impExisting++
      else impAdd++
    }

    return NextResponse.json({
      ok: true,
      dryRun: true,
      file: body.file ?? null,
      summary: {
        predictions: { add: predAdd, change: predChange, total: incomingPreds.length },
        results: { add: resAdd, change: resChange, total: incomingResults.length },
        importedRows: { add: impAdd, overwrite: impExisting, total: incomingImported.length }
      }
    })
  }

  // ── APPLY: merge-upsert only — never delete-all (INV-11). ─────────────────
  for (const r of incomingPreds) {
    if (!r.player || !Number.isInteger(Number(r.matchId))) continue
    await sql`
      INSERT INTO predictions (player, match_id, h, a, community)
      VALUES (${r.player}, ${Number(r.matchId)}, ${Number(r.h)}, ${Number(r.a)}, ${r.community ?? 'hu'})
      ON CONFLICT (player, match_id, community) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
    `
  }
  for (const r of incomingResults) {
    if (!Number.isInteger(Number(r.matchId))) continue
    await sql`
      INSERT INTO results (match_id, h, a, pen_h, pen_a)
      VALUES (${Number(r.matchId)}, ${Number(r.h)}, ${Number(r.a)}, ${r.pen_h ?? null}, ${r.pen_a ?? null})
      ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a, pen_h = EXCLUDED.pen_h, pen_a = EXCLUDED.pen_a
    `
  }
  for (const r of incomingImported) {
    if (!r.tableName || r.convexId == null) continue
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES (${r.tableName}, ${r.convexId}, ${JSON.stringify(r.payload ?? {})}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
  }

  await logTxn({
    type: 'backup_restore',
    label: `Állapot visszaállítva mentésből (${incomingPreds.length} tipp, ${incomingResults.length} eredmény, ${incomingImported.length} sor)`,
    path: 'all',
    after: { file: body.file ?? null }
  })
  return NextResponse.json({
    ok: true,
    applied: { predictions: incomingPreds.length, results: incomingResults.length, importedRows: incomingImported.length }
  })
}

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  action?: 'list' | 'setHandled'
  id?: string
  handled?: boolean
}

type StoredLead = {
  id: number
  convexId: string | null
  payload: Record<string, unknown>
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

  try {
    if (body.action === 'setHandled') return await setHandled(String(body.id ?? ''), body.handled === true)
    return await listLeads()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function listLeads() {
  const rows = await loadLeadRows()
  return NextResponse.json({
    ok: true,
    leads: rows
      .map((row) => {
        const p = row.payload ?? {}
        return {
          id: row.convexId ?? String(row.id),
          name: String(p.name ?? ''),
          contact: String(p.contact ?? ''),
          message: String(p.message ?? ''),
          community: p.community === 'en' ? 'en' : 'hu',
          ts: Number(p.ts ?? 0),
          handled: p.handled === true
        }
      })
      .sort((a, b) => b.ts - a.ts)
  })
}

async function setHandled(id: string, handled: boolean) {
  if (!id) return NextResponse.json({ ok: false, error: 'bad-id' }, { status: 400 })
  const row = (await loadLeadRows()).find((entry) => entry.convexId === id || String(entry.id) === id)
  if (!row) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 })

  const payload: Record<string, unknown> = {
    ...(row.payload ?? {}),
    handled,
    handledAt: handled ? Date.now() : null
  }
  const sql = getSql()
  await sql`UPDATE imported_rows SET payload = ${JSON.stringify(payload)}::jsonb WHERE id = ${row.id}`
  await logTxn({
    type: 'lead_handled',
    label: `Érdeklődő ${handled ? 'kezelve' : 'újranyitva'}: ${String(payload.name ?? id)}`,
    path: 'leads',
    before: row.payload,
    after: payload
  })
  return NextResponse.json({ ok: true })
}

async function loadLeadRows(): Promise<StoredLead[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, convex_id AS "convexId", payload
    FROM imported_rows
    WHERE table_name = 'interestLeads'
    ORDER BY id DESC
  `
  return rows as StoredLead[]
}

import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin endpoint: read / set / clear the claim code that gates first-login PIN claims
// (S3 mitigation). When a code is set, /api/auth/player-pin requires it in the body
// before allowing a new player to claim their PIN — preventing pre-emptive account
// takeover via the public roster.
//
// GET  → { ok: true, isSet: boolean }  (never reveals the code value)
// POST { code: string } → set the claim code
// POST { code: null }   → clear it (open claims again)

export async function GET(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  const sql = getSql()
  const rows = await sql`
    SELECT payload FROM imported_rows
    WHERE table_name = 'adminAuth' AND convex_id = 'claimCode'
    LIMIT 1
  `
  const isSet = Boolean((rows as Array<{ payload: any }>)[0]?.payload?.code)
  return NextResponse.json({ ok: true, isSet })
}

export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  let body: { code?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const sql = getSql()
  const code = body.code ? String(body.code).trim() : null

  if (!code) {
    await sql`
      DELETE FROM imported_rows
      WHERE table_name = 'adminAuth' AND convex_id = 'claimCode'
    `
    return NextResponse.json({ ok: true, isSet: false })
  }

  await sql`
    INSERT INTO imported_rows (table_name, convex_id, payload)
    VALUES ('adminAuth', 'claimCode', ${JSON.stringify({ code })}::jsonb)
    ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
  `
  return NextResponse.json({ ok: true, isSet: true })
}

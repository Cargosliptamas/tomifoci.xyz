import { NextResponse } from 'next/server'
import { runLiveScorePoll } from '@/lib/livescore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// LiveScore poll — triggered by Vercel Cron (see vercel.json) or manually by an admin.
// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. An admin may also trigger
// it with the `x-admin-token` header. If neither secret is configured, the route is open
// (still safe — it only writes recomputable cache + merge-upsert results).
function authorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  const adminToken = process.env.ADMIN_TOKEN
  if (!cronSecret && !adminToken) return true
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) return true
  if (adminToken && request.headers.get('x-admin-token') === adminToken) return true
  return false
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runLiveScorePoll()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 503 })
}

export const GET = handle
export const POST = handle

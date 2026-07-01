import { NextResponse } from 'next/server'
import { runLiveScorePoll } from '@/lib/livescore'
import { sendResultPush } from '@/lib/result-notifications'

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
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) return true
  // Manual admin trigger.
  if (adminToken && request.headers.get('x-admin-token') === adminToken) return true
  // No CRON_SECRET configured → allow (the scheduled Vercel cron can't send one, and the
  // poll only writes recomputable cache + merge-upsert results). ADMIN_TOKEN alone must NOT
  // gate the cron, or the schedule 401s.
  if (!cronSecret) return true
  return false
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runLiveScorePoll()
  const push = summary.ok ? await sendResultPush(summary.writtenResults ?? []) : undefined
  return NextResponse.json(push ? { ...summary, push } : summary, { status: summary.ok ? 200 : 503 })
}

export const GET = handle
export const POST = handle

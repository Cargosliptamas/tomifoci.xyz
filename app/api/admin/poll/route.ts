import { NextResponse } from 'next/server'
import { runLiveScorePoll } from '@/lib/livescore'
import { adminGuard } from '@/lib/admin'
import { sendResultPush } from '@/lib/result-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Manual (emergency) LiveScore poll. Same admin guard as the other admin
// writes: ADMIN_TOKEN, plus signed session when ADMIN_TOTP_SECRET is configured.
// Normal polling runs server-side on a cron (app/api/cron/poll) — this endpoint
// exists only for the admin "vészhelyzeti kézi poll" button and burns API quota.
export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  const summary = await runLiveScorePoll()
  const push = summary.ok ? await sendResultPush(summary.writtenResults ?? []) : undefined
  if (push) return NextResponse.json({ ...summary, push }, { status: summary.ok ? 200 : 502 })
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 })
}

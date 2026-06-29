import { NextResponse } from 'next/server'
import { runLiveScorePoll } from '@/lib/livescore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Manual (emergency) LiveScore poll. Same ADMIN_TOKEN guard as the other admin
// writes: 503 if the token isn't configured at all, 401 if present but wrong.
// Normal polling runs server-side on a cron (app/api/cron/poll) — this endpoint
// exists only for the admin "vészhelyzeti kézi poll" button and burns API quota.
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

  const summary = await runLiveScorePoll()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 })
}

import { NextResponse } from 'next/server'
import { upsertImportedRow } from '../../../../lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stable, short key for a subscription endpoint so re-subscribes upsert in place
// rather than piling up duplicate rows. djb2 hash → unsigned hex.
function endpointHash(endpoint: string): string {
  let h = 5381
  for (let i = 0; i < endpoint.length; i++) {
    h = (h * 33) ^ endpoint.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 })
  }

  const subscription = body?.subscription
  const endpoint: unknown = subscription?.endpoint
  if (!subscription || typeof endpoint !== 'string' || !endpoint) {
    return NextResponse.json({ ok: false, error: 'missing-subscription' }, { status: 400 })
  }

  const convexId = `sub:${endpointHash(endpoint)}`
  try {
    await upsertImportedRow('pushSubscriptions', convexId, {
      endpoint,
      subscription,
      community: typeof body?.community === 'string' ? body.community : 'hu',
      player: typeof body?.player === 'string' ? body.player : null,
      updatedAt: Date.now(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'store-failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

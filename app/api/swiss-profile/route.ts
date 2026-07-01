import { NextResponse } from 'next/server'
import { getImportedRows, upsertImportedRow } from '@/lib/db'
import { verifyPlayerPinThrottled } from '@/lib/throttle'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { player?: string; pin?: string; community?: string; active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const player = String(body.player ?? '').trim()
  const pin = String(body.pin ?? '').trim()
  const community = body.community === 'en' ? 'en' : 'hu'
  if (community !== 'hu')
    return NextResponse.json({ ok: false, error: 'unsupported-community' }, { status: 400 })
  if (!player || !/^\d{4}$/.test(pin))
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })

  if (!(process.env.TEST_LOGIN_USER && player === process.env.TEST_LOGIN_USER)) {
    const pinResult = await verifyPlayerPinThrottled(request, player, pin, community)
    if (!pinResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: pinResult.error,
          ...(pinResult.retryAfterMs ? { retryAfterMs: pinResult.retryAfterMs } : {})
        },
        { status: pinResult.status }
      )
    }
  }

  const existing = (await getImportedRows('swissProfiles')).find(
    (row) => row.player === player && (row.community ?? 'hu') === community
  )
  const active = body.active === true
  if (active && existing?.removedAtRound != null) {
    return NextResponse.json({ ok: false, error: 'admin-restore-required' }, { status: 409 })
  }
  await upsertImportedRow('swissProfiles', `${community}:${player}`, {
    ...existing,
    player,
    community,
    active,
    joinedRound: existing?.joinedRound ?? 1,
    removedAtRound: existing?.removedAtRound ?? null,
    updatedAt: Date.now(),
    source: 'profile'
  })
  return NextResponse.json({ ok: true })
}

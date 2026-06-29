import { NextResponse } from 'next/server'
import { verifyPlayerPinInNeon } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { player?: string; pin?: string; community?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const player = String(body.player ?? '').trim()
  const pin = String(body.pin ?? '').trim()
  const community = body.community === 'en' ? 'en' : 'hu'

  if (!player || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  try {
    const result = await verifyPlayerPinInNeon(player, pin, community)
    if (result.ok) return NextResponse.json({ ok: true })

    // pin-hashes-empty / player-pin-not-found => auth not provisioned in Neon yet.
    const notProvisioned = result.reason === 'pin-hashes-empty' || result.reason === 'player-pin-not-found'
    return NextResponse.json(
      { ok: false, error: notProvisioned ? 'auth-not-provisioned' : 'bad-pin' },
      { status: notProvisioned ? 503 : 401 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

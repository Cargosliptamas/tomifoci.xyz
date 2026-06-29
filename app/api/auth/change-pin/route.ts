import { NextResponse } from 'next/server'
import { changePlayerPinInNeon } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { player?: string; pin?: string; newPin?: string; community?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const player = String(body.player ?? '').trim()
  const oldPin = String(body.pin ?? '').trim()
  const newPin = String(body.newPin ?? '').trim()
  const community = body.community === 'en' ? 'en' : 'hu'

  // newPin must be 4 digits. oldPin is optional (claim-on-first-login) but, when
  // supplied, must look like a PIN.
  if (!player || !/^\d{4}$/.test(newPin) || (oldPin && !/^\d{4}$/.test(oldPin))) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  try {
    const result = await changePlayerPinInNeon(player, oldPin, newPin, community)
    if (result.ok) return NextResponse.json({ ok: true })
    return NextResponse.json({ ok: false, error: 'bad-pin' }, { status: 401 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

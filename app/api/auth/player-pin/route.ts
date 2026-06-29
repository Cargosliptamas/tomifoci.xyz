import { NextResponse } from 'next/server'
import { verifyPlayerPinInNeon, setPlayerPinInNeon } from '@/lib/db'

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

  // Test-login bypass: the single allowlisted automated-test user (e.g. Firecrawl) may log
  // in WITHOUT a PIN. Off by default — only active when TEST_LOGIN_USER env is set to that
  // exact name. A disableable backdoor for crawling/QA, never a generic open door.
  if (process.env.TEST_LOGIN_USER && player === process.env.TEST_LOGIN_USER) {
    return NextResponse.json({ ok: true, claimed: false, test: true })
  }

  if (!player || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  try {
    const result = await verifyPlayerPinInNeon(player, pin, community)
    if (result.ok) return NextResponse.json({ ok: true, claimed: false })

    // No PIN on file for this player yet (table empty or player missing) →
    // claim-on-first-login: this PIN becomes their PIN.
    if (result.reason === 'pin-hashes-empty' || result.reason === 'player-pin-not-found') {
      const claimed = await setPlayerPinInNeon(player, pin, community)
      if (claimed) return NextResponse.json({ ok: true, claimed: true })
      // Race: someone set it between checks — re-verify.
      const recheck = await verifyPlayerPinInNeon(player, pin, community)
      if (recheck.ok) return NextResponse.json({ ok: true, claimed: false })
      return NextResponse.json({ ok: false, error: 'bad-pin' }, { status: 401 })
    }

    return NextResponse.json({ ok: false, error: 'bad-pin' }, { status: 401 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { verifyPlayerPinInNeon, getImportedRows, upsertImportedRow } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Set / switch the player's favourite team. Switch-window rules (free until first WC match,
// once until first KO, locked after) are enforced in a later pass; here we record the choice
// and flag a switch when one already exists.
export async function POST(request: Request) {
  let body: { player?: string; pin?: string; community?: string; team?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const player = String(body.player ?? '').trim()
  const pin = String(body.pin ?? '').trim()
  const community = body.community === 'en' ? 'en' : 'hu'
  const team = String(body.team ?? '').trim()

  if (!player || !/^\d{4}$/.test(pin) || !team) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const pinResult = await verifyPlayerPinInNeon(player, pin, community)
  if (!pinResult.ok) {
    const notProvisioned = pinResult.reason === 'pin-hashes-empty' || pinResult.reason === 'player-pin-not-found'
    return NextResponse.json(
      { ok: false, error: notProvisioned ? 'auth-not-provisioned' : 'bad-pin' },
      { status: notProvisioned ? 503 : 401 }
    )
  }

  try {
    const existing = (await getImportedRows('favorites')).find(
      (row) => row.player === player && (row.community ?? 'hu') === community
    )
    const payload = existing?.team
      ? { ...existing, player, community, switched: true, newTeam: team }
      : { player, community, team, switched: false, newTeam: null, pendingKO: false }

    await upsertImportedRow('favorites', `${community}:${player}`, payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

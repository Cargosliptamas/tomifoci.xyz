import { NextResponse } from 'next/server'
import { verifyPlayerPinInNeon, getImportedRows, upsertImportedRow } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Favourite switch-window (SCORE-11), enforced server-side:
//  (a) free + unlimited until the WC's first match kickoff (2026-06-11 21:00 CET)
//  (b) at most ONE switch until the first KO match kickoff (2026-06-28 21:00 CET); a switch
//      made in the group stage takes effect only from the KO stage (pendingKO) — the original
//      team keeps doubling until then
//  (c) locked once the first KO match has started
const WC_FIRST_MS = Date.UTC(2026, 5, 11, 19, 0, 0) // 21:00 CET
const KO_FIRST_MS = Date.UTC(2026, 5, 28, 19, 0, 0) // 21:00 CET

export function favPhase(now = Date.now()): 'free' | 'once' | 'locked' {
  if (now < WC_FIRST_MS) return 'free'
  if (now < KO_FIRST_MS) return 'once'
  return 'locked'
}

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

  const phase = favPhase()
  if (phase === 'locked') {
    return NextResponse.json({ ok: false, error: 'fav-locked' }, { status: 423 })
  }

  try {
    const existing = (await getImportedRows('favorites')).find(
      (row) => row.player === player && (row.community ?? 'hu') === community
    )

    let payload: Record<string, unknown>
    if (phase === 'free') {
      // Unlimited free changes — this is just the current favourite, no switch recorded.
      payload = { player, community, team, switched: false, newTeam: null, pendingKO: false }
    } else {
      // phase 'once': allow a first favourite, or exactly one switch.
      if (!existing?.team) {
        payload = { player, community, team, switched: false, newTeam: null, pendingKO: false }
      } else if (existing.switched) {
        return NextResponse.json({ ok: false, error: 'switch-used' }, { status: 409 })
      } else {
        // group-stage switch takes effect from KO: keep original team, mark pendingKO.
        payload = { ...existing, player, community, switched: true, newTeam: team, pendingKO: true }
      }
    }

    await upsertImportedRow('favorites', `${community}:${player}`, payload)
    return NextResponse.json({ ok: true, phase })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

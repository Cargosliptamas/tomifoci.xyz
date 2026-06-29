import { verifyPlayerPinInNeon } from './db'
import { isKickedOff } from './engine'

export type GuardResult =
  | { ok: true; community: 'hu' | 'en'; player: string }
  | { ok: false; status: number; error: string }

// Shared write guard: validate PIN (auth) and enforce the server-side kickoff lock (INV-10).
export async function guardWrite(body: {
  player?: string
  pin?: string
  community?: string
  matchId?: number
}): Promise<GuardResult> {
  const player = String(body.player ?? '').trim()
  const pin = String(body.pin ?? '').trim()
  const community = body.community === 'en' ? 'en' : 'hu'
  const matchId = Number(body.matchId)

  if (!player || !Number.isInteger(matchId)) {
    return { ok: false, status: 400, error: 'bad-request' }
  }

  // Automated-test user (e.g. Firecrawl): skip PIN + kickoff lock so a crawler can exercise
  // writes. Off unless TEST_LOGIN_USER env names this exact player.
  if (process.env.TEST_LOGIN_USER && player === process.env.TEST_LOGIN_USER) {
    return { ok: true, community, player }
  }

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, status: 400, error: 'bad-request' }
  }

  if (isKickedOff(matchId, Date.now())) {
    return { ok: false, status: 423, error: 'match-locked' }
  }

  const pinResult = await verifyPlayerPinInNeon(player, pin, community)
  if (!pinResult.ok) {
    const notProvisioned = pinResult.reason === 'pin-hashes-empty' || pinResult.reason === 'player-pin-not-found'
    return {
      ok: false,
      status: notProvisioned ? 503 : 401,
      error: notProvisioned ? 'auth-not-provisioned' : 'bad-pin'
    }
  }

  return { ok: true, community, player }
}

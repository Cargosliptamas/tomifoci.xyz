import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { adminGuard, logTxn, importedRowsWithIds } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin Swiss / Párbaj — data-level operations on swissPairings + swissProfiles.
// We deliberately do NOT reimplement the Swiss engine here: standings, match
// points, Buchholz and playoff seeding are all re-derived live from these stored
// inputs + predictions + results on every read (lib/client-state computeLiveSwiss).
// Reshuffle does a simple random re-pairing of the eligible field for one round —
// not the seeded Swiss/playoff algorithm, which lives in packages/game-engine.

type Pairing = { round: number; a: string; b: string | null; tier?: number | null; slot?: string | null; publishedBy: string }

type Body = {
  action?: 'publish' | 'reshuffle' | 'add' | 'remove'
  round?: number
  player?: string
}

export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  try {
    switch (body.action) {
      case 'publish':
        return await publish(Number(body.round))
      case 'reshuffle':
        return await reshuffle(Number(body.round))
      case 'add':
        return await addPlayer(String(body.player ?? '').trim(), Number(body.round))
      case 'remove':
        return await removePlayer(String(body.player ?? '').trim(), Number(body.round))
      default:
        return NextResponse.json({ ok: false, error: 'bad-action' }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function eligiblePlayers(round: number): Promise<string[]> {
  const profiles = await importedRowsWithIds('swissProfiles')
  return profiles
    .map((row) => row.payload ?? {})
    .filter((p) => p.player && p.active !== false && p.removedAtRound == null && Number(p.joinedRound ?? 1) <= round)
    .map((p) => String(p.player))
    .sort()
}

function drawPairings(players: string[], round: number): Pairing[] {
  const order = [...players]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const out: Pairing[] = []
  for (let i = 0; i + 1 < order.length; i += 2) out.push({ round, a: order[i], b: order[i + 1], publishedBy: 'admin' })
  if (order.length % 2) out.push({ round, a: order[order.length - 1], b: null, publishedBy: 'admin' }) // bye
  return out
}

async function writeRoundPairings(round: number, pairings: Pairing[]): Promise<void> {
  const sql = getSql()
  // Replace this round's pairings only — never delete-all (INV-11): rows for other
  // rounds are untouched.
  await sql`DELETE FROM imported_rows WHERE table_name = 'swissPairings' AND payload->>'round' = ${String(round)}`
  let i = 0
  for (const p of pairings) {
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('swissPairings', ${`${round}:${i++}`}, ${JSON.stringify(p)}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
  }
}

async function publish(round: number) {
  if (!Number.isInteger(round) || round < 1 || round > 13) {
    return NextResponse.json({ ok: false, error: 'bad-round' }, { status: 400 })
  }
  const sql = getSql()
  const existing = (await importedRowsWithIds('swissPairings')).filter((row) => Number(row.payload?.round) === round)

  if (existing.length) {
    // Stamp the already-drawn pairings as admin-published.
    for (const row of existing) {
      const payload = { ...row.payload, publishedBy: 'admin' }
      await sql`UPDATE imported_rows SET payload = ${JSON.stringify(payload)}::jsonb WHERE id = ${row.id}`
    }
  } else {
    // Nothing drawn yet — draw a random pairing for the eligible field and publish.
    const players = await eligiblePlayers(round)
    if (players.length < 2) return NextResponse.json({ ok: false, error: 'not-enough-players' }, { status: 409 })
    await writeRoundPairings(round, drawPairings(players, round))
  }

  await logTxn({ type: 'swiss', label: `${round}. forduló párosítás publikálva`, path: 'swissPairings' })
  return NextResponse.json({ ok: true })
}

async function reshuffle(round: number) {
  if (!Number.isInteger(round) || round < 1 || round > 13) {
    return NextResponse.json({ ok: false, error: 'bad-round' }, { status: 400 })
  }
  const players = await eligiblePlayers(round)
  if (players.length < 2) return NextResponse.json({ ok: false, error: 'not-enough-players' }, { status: 409 })
  await writeRoundPairings(round, drawPairings(players, round))
  await logTxn({ type: 'swiss', label: `${round}. forduló újrasorsolva`, path: 'swissPairings' })
  return NextResponse.json({ ok: true })
}

async function addPlayer(player: string, round: number) {
  if (!player) return NextResponse.json({ ok: false, error: 'bad-player' }, { status: 400 })
  const sql = getSql()
  const joinedRound = Number.isInteger(round) && round >= 1 ? round : 1
  const existing = (await importedRowsWithIds('swissProfiles')).find((row) => row.payload?.player === player)
  if (existing) {
    // Re-activate an existing (possibly removed) profile.
    const payload = { ...existing.payload, active: true, removedAtRound: null }
    await sql`UPDATE imported_rows SET payload = ${JSON.stringify(payload)}::jsonb WHERE id = ${existing.id}`
  } else {
    const payload = { player, active: true, joinedRound, removedAtRound: null }
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('swissProfiles', ${`hu:${player}`}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
  }
  await logTxn({ type: 'swiss', label: `Játékos hozzáadva a ligához: ${player}`, path: 'swissProfiles', after: player })
  return NextResponse.json({ ok: true })
}

async function removePlayer(player: string, round: number) {
  if (!player) return NextResponse.json({ ok: false, error: 'bad-player' }, { status: 400 })
  const sql = getSql()
  const existing = (await importedRowsWithIds('swissProfiles')).find((row) => row.payload?.player === player)
  if (!existing) return NextResponse.json({ ok: false, error: 'player-not-in-league' }, { status: 404 })
  const removalRound = Number.isInteger(round) && round >= 1 ? round : 1
  const payload = { ...existing.payload, removedAtRound: removalRound }
  await sql`UPDATE imported_rows SET payload = ${JSON.stringify(payload)}::jsonb WHERE id = ${existing.id}`
  await logTxn({ type: 'swiss', label: `Játékos eltávolítva a ligából: ${player}`, path: 'swissProfiles', before: player })
  return NextResponse.json({ ok: true })
}

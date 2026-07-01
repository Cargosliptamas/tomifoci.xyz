import { NextResponse } from 'next/server'
import { getSql, resetPlayerPinInNeon } from '@/lib/db'
import {
  adminGuard,
  logTxn,
  importedRowsWithIds,
  deleteImportedRowById,
  readRoster,
  writeRoster,
  rowMatchesPlayer,
  NAME_KEYED_TABLES,
  HU_ONLY_TABLES,
  type RosterPlayer
} from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin player management — create / rename / soft-delete / restore.
// Player identity = name string (INV-02): every rename or delete must cascade
// across predictions + every name-keyed imported table. Soft-delete snapshots the
// player's raw data into the 'deletedPlayers' table with a 10-day restore window
// (SPEC_DIGEST), then cascade-removes them. All truth writes are merge-upsert and
// never delete-all (INV-11). Scores/rankings re-derive live on the next read.

const TEN_DAYS_MS = 10 * 24 * 3600 * 1000

type Body = {
  action?: 'create' | 'rename' | 'delete' | 'restore' | 'setPin'
  name?: string
  oldName?: string
  newName?: string
  pin?: string
  community?: 'hu' | 'en'
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

  const community: 'hu' | 'en' = body.community === 'en' ? 'en' : 'hu'

  try {
    switch (body.action) {
      case 'create':
        return await createPlayer(body.name, community)
      case 'rename':
        return await renamePlayer(String(body.oldName ?? ''), String(body.newName ?? ''), community)
      case 'delete':
        return await deletePlayer(String(body.name ?? ''), community)
      case 'restore':
        return await restorePlayer(String(body.name ?? ''), community)
      case 'setPin':
        return await setPlayerPin(String(body.name ?? ''), String(body.pin ?? ''), community)
      default:
        return NextResponse.json({ ok: false, error: 'bad-action' }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function createPlayer(rawName: string | undefined, community: 'hu' | 'en') {
  const roster = await readRoster(community)
  if (!roster) return NextResponse.json({ ok: false, error: 'no-settings' }, { status: 500 })

  // The "+ Új játékos" button sends no name — generate a unique placeholder.
  let name = (rawName ?? '').trim()
  if (!name) {
    let n = roster.players.length + 1
    do {
      name = `Új játékos ${n++}`
    } while (roster.players.some((p) => p.name === name))
  }
  if (roster.players.some((p) => p.name === name)) {
    return NextResponse.json({ ok: false, error: 'name-taken' }, { status: 409 })
  }

  const next: RosterPlayer[] = [...roster.players, { name, leagues: [] }]
  await writeRoster(community, roster.settingsId, next)
  await logTxn({ type: 'player_create', label: `Játékos létrehozva: ${name}`, path: 'players', after: name })
  return NextResponse.json({ ok: true, name })
}

async function renamePlayer(oldName: string, newName: string, community: 'hu' | 'en') {
  if (!oldName || !newName) return NextResponse.json({ ok: false, error: 'bad-name' }, { status: 400 })
  if (oldName === newName) return NextResponse.json({ ok: true, unchanged: true })

  const sql = getSql()

  // predictions — typed table, unique by (player, matchId, community). Drop the
  // old row if the target already has a prediction for that match, else relabel.
  const newMatches = (await sql`
    SELECT match_id AS "matchId" FROM predictions WHERE player = ${newName} AND community = ${community}
  `) as Array<{ matchId: number }>
  const taken = new Set(newMatches.map((r) => r.matchId))
  const oldPreds = (await sql`
    SELECT id, match_id AS "matchId" FROM predictions WHERE player = ${oldName} AND community = ${community}
  `) as Array<{ id: number; matchId: number }>
  for (const r of oldPreds) {
    if (taken.has(r.matchId)) await sql`DELETE FROM predictions WHERE id = ${r.id}`
    else await sql`UPDATE predictions SET player = ${newName} WHERE id = ${r.id}`
  }

  // Name-keyed imported tables: relabel the stored name. Wizard/Swiss are HU-only.
  const tables = community === 'en' ? NAME_KEYED_TABLES : [...NAME_KEYED_TABLES, ...HU_ONLY_TABLES]
  for (const table of tables) {
    const rows = await importedRowsWithIds(table)
    for (const row of rows) {
      if (!rowMatchesPlayer(table, row, oldName, community)) continue
      const payload = { ...row.payload }
      if (table === 'pinHashes') payload.name = newName
      else payload.player = newName
      // Re-key under a fresh convex_id derived from the new name to keep keys
      // consistent; the loader reads payloads, so the key choice is cosmetic.
      const newKey = newKeyFor(table, row, newName, community)
      await sql`DELETE FROM imported_rows WHERE id = ${row.id}`
      await sql`
        INSERT INTO imported_rows (table_name, convex_id, payload)
        VALUES (${table}, ${newKey}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
      `
    }
  }

  // swissPairings (HU-only): relabel a/b in place.
  if (community === 'hu') {
    const pairs = await importedRowsWithIds('swissPairings')
    for (const row of pairs) {
      const p = row.payload ?? {}
      if (p.a !== oldName && p.b !== oldName) continue
      const payload = { ...p }
      if (payload.a === oldName) payload.a = newName
      if (payload.b === oldName) payload.b = newName
      await sql`UPDATE imported_rows SET payload = ${JSON.stringify(payload)}::jsonb WHERE id = ${row.id}`
    }
  }

  // Roster: rename the account entry (drop old if the new name already exists).
  const roster = await readRoster(community)
  if (roster) {
    const hasNew = roster.players.some((p) => p.name === newName)
    const next = roster.players
      .filter((p) => !(p.name === oldName && hasNew))
      .map((p) => (p.name === oldName ? { ...p, name: newName } : p))
    await writeRoster(community, roster.settingsId, next)
  }

  await logTxn({
    type: 'rename',
    label: `Átnevezés: ${oldName} → ${newName}`,
    path: 'players',
    before: oldName,
    after: newName
  })
  return NextResponse.json({ ok: true })
}

function newKeyFor(
  table: string,
  row: { convexId: string | null; payload: Record<string, any> },
  name: string,
  community: 'hu' | 'en'
) {
  if (table === 'wizardPicks') {
    const matchId = row.payload?.matchId
    return matchId != null ? `${community}:${name}:${matchId}` : `${community}:${name}`
  }
  if (table === 'wizardProfiles' || table === 'swissProfiles') return `${community}:${name}`
  if (table === 'favorites' || table === 'pinHashes') return `${community}:${name}`
  if (table === 'bonuses') return `${community}:${name}:${row.payload?.ts ?? crypto.randomUUID().slice(0, 8)}`
  return row.convexId ?? `${community}:${name}`
}

async function deletePlayer(name: string, community: 'hu' | 'en') {
  if (!name) return NextResponse.json({ ok: false, error: 'bad-name' }, { status: 400 })
  const sql = getSql()

  // 1. Snapshot raw truth so the deletion is restorable (10-day window).
  const snapshot = await snapshotPlayer(name, community)

  // 2. Cascade-remove from predictions + every name-keyed imported table (INV-02).
  await sql`DELETE FROM predictions WHERE player = ${name} AND community = ${community}`
  const tables = community === 'en' ? NAME_KEYED_TABLES : [...NAME_KEYED_TABLES, ...HU_ONLY_TABLES]
  for (const table of tables) {
    const rows = await importedRowsWithIds(table)
    for (const row of rows)
      if (rowMatchesPlayer(table, row, name, community)) await deleteImportedRowById(row.id)
  }

  // swissPairings: opponents of a removed player get a bye (HU-only).
  if (community === 'hu') {
    const pairs = await importedRowsWithIds('swissPairings')
    for (const row of pairs) {
      const p = row.payload ?? {}
      const aIs = p.a === name
      const bIs = p.b === name
      if (!aIs && !bIs) continue
      if (aIs && bIs) await deleteImportedRowById(row.id)
      else if (aIs) {
        if (p.b)
          await sql`UPDATE imported_rows SET payload = ${JSON.stringify({ ...p, a: p.b, b: null })}::jsonb WHERE id = ${row.id}`
        else await deleteImportedRowById(row.id)
      } else {
        await sql`UPDATE imported_rows SET payload = ${JSON.stringify({ ...p, b: null })}::jsonb WHERE id = ${row.id}`
      }
    }
  }

  // 3. Drop from the roster so the player leaves login + leaderboards.
  const roster = await readRoster(community)
  if (roster) {
    const next = roster.players.filter((p) => p.name !== name)
    if (next.length !== roster.players.length) await writeRoster(community, roster.settingsId, next)
  }

  // 4. Archive the snapshot (one row per name+community, overwrites any prior).
  await sql`
    INSERT INTO imported_rows (table_name, convex_id, payload)
    VALUES ('deletedPlayers', ${`${community}:${name}`}, ${JSON.stringify({ player: name, community, deletedAt: Date.now(), data: snapshot })}::jsonb)
    ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
  `

  await logTxn({
    type: 'player_delete',
    label: `Játékos törölve (10 napig visszaállítható): ${name}`,
    path: 'players',
    before: name,
    after: null
  })
  return NextResponse.json({ ok: true, deleted: name })
}

async function snapshotPlayer(name: string, community: 'hu' | 'en') {
  const sql = getSql()
  const predictions = (await sql`
    SELECT player, match_id AS "matchId", h, a, community
    FROM predictions WHERE player = ${name} AND community = ${community}
  `) as Array<Record<string, any>>

  const data: Record<string, any> = { predictions }
  const tables = community === 'en' ? NAME_KEYED_TABLES : [...NAME_KEYED_TABLES, ...HU_ONLY_TABLES]
  for (const table of tables) {
    const rows = await importedRowsWithIds(table)
    data[table] = rows
      .filter((row) => rowMatchesPlayer(table, row, name, community))
      .map((row) => ({ convexId: row.convexId, payload: row.payload }))
  }

  const roster = await readRoster(community)
  data.rosterEntry = roster?.players.find((p) => p.name === name) ?? null
  return data
}

async function restorePlayer(name: string, community: 'hu' | 'en') {
  if (!name) return NextResponse.json({ ok: false, error: 'bad-name' }, { status: 400 })
  const sql = getSql()

  const archived = (await sql`
    SELECT id, payload FROM imported_rows
    WHERE table_name = 'deletedPlayers' AND convex_id = ${`${community}:${name}`}
    ORDER BY id DESC LIMIT 1
  `) as Array<{ id: number; payload: Record<string, any> }>
  const row = archived[0]
  if (!row) return NextResponse.json({ ok: false, error: 'nothing-to-restore' }, { status: 404 })

  const archivedAt = Number(row.payload?.deletedAt ?? 0)
  if (archivedAt && Date.now() - archivedAt > TEN_DAYS_MS) {
    await sql`DELETE FROM imported_rows WHERE id = ${row.id}`
    return NextResponse.json({ ok: false, error: 'restore-window-expired' }, { status: 410 })
  }

  const data = row.payload?.data ?? {}

  // Re-insert predictions (merge-upsert; never delete-all — INV-11).
  for (const p of (data.predictions ?? []) as Array<Record<string, any>>) {
    await sql`
      INSERT INTO predictions (player, match_id, h, a, community)
      VALUES (${p.player}, ${Number(p.matchId)}, ${Number(p.h)}, ${Number(p.a)}, ${p.community ?? community})
      ON CONFLICT (player, match_id, community) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
    `
  }

  // Re-insert each archived imported row under its stored key.
  const tables = community === 'en' ? NAME_KEYED_TABLES : [...NAME_KEYED_TABLES, ...HU_ONLY_TABLES]
  for (const table of tables) {
    for (const entry of (data[table] ?? []) as Array<{
      convexId: string | null
      payload: Record<string, any>
    }>) {
      const key = entry.convexId ?? `${community}:${name}:${crypto.randomUUID().slice(0, 8)}`
      await sql`
        INSERT INTO imported_rows (table_name, convex_id, payload)
        VALUES (${table}, ${key}, ${JSON.stringify(entry.payload)}::jsonb)
        ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
      `
    }
  }

  // Roster: re-add the account entry if missing.
  const roster = await readRoster(community)
  if (roster && data.rosterEntry && !roster.players.some((p) => p.name === name)) {
    await writeRoster(community, roster.settingsId, [...roster.players, data.rosterEntry])
  }

  await sql`DELETE FROM imported_rows WHERE id = ${row.id}`
  await logTxn({
    type: 'player_restore',
    label: `Játékos visszaállítva: ${name}`,
    path: 'players',
    before: null,
    after: name
  })
  return NextResponse.json({ ok: true, restored: name })
}

async function setPlayerPin(name: string, pin: string, community: 'hu' | 'en') {
  if (!name || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }
  const roster = await readRoster(community)
  if (roster && !roster.players.some((p) => p.name === name)) {
    return NextResponse.json({ ok: false, error: 'player-not-found' }, { status: 404 })
  }
  await resetPlayerPinInNeon(name, pin, community)
  await logTxn({
    type: 'player_pin_reset',
    label: `PIN reset: ${name}`,
    path: 'players',
    before: null,
    after: { player: name, community }
  })
  return NextResponse.json({ ok: true })
}

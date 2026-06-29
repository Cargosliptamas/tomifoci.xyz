import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

// ── Admin auth guard ─────────────────────────────────────────────────────────
// Same contract as app/api/admin/result/route.ts: 503 if the token isn't
// configured at all, 401 if it's present but doesn't match. Until the adminAuth
// table is seeded in Neon, ADMIN_TOKEN is the only thing protecting truth writes.
export function authorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  return request.headers.get('x-admin-token') === token
}

// Returns a NextResponse to short-circuit with, or null when the request is
// authorised and the handler may proceed.
export function adminGuard(request: Request): NextResponse | null {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: 'admin-not-configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return null
}

// ── Transaction log ──────────────────────────────────────────────────────────
// Every truth write appends one txnlog row {ts, who:'admin', type, label}. before/
// after are stored alongside so prediction txns can be rolled back; client-state
// only surfaces ts/who/type/label/path, so the extra fields are harmless.
export type TxnEntry = {
  type: string
  label: string
  who?: string
  path?: string
  before?: unknown
  after?: unknown
}

export async function logTxn(entry: TxnEntry): Promise<number> {
  const ts = Date.now()
  const sql = getSql()
  const convexId = `${ts}:${crypto.randomUUID().slice(0, 8)}`
  const payload = {
    ts,
    who: entry.who ?? 'admin',
    type: entry.type,
    label: entry.label,
    path: entry.path ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null
  }
  await sql`
    INSERT INTO imported_rows (table_name, convex_id, payload)
    VALUES ('txnlog', ${convexId}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (table_name, convex_id) DO NOTHING
  `
  return ts
}

// ── Imported-row helpers (carry id + convex_id, unlike lib/db getImportedRows) ─
export type StoredRow = { id: number; convexId: string | null; payload: Record<string, any> }

export async function importedRowsWithIds(tableName: string): Promise<StoredRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, convex_id AS "convexId", payload
    FROM imported_rows
    WHERE table_name = ${tableName}
    ORDER BY id ASC
  `
  return rows as StoredRow[]
}

export async function deleteImportedRowById(id: number): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM imported_rows WHERE id = ${id}`
}

// ── Settings roster (players live in the typed settings.players jsonb column) ──
export type RosterPlayer = { name: string; leagues?: string[] }

export async function readRoster(
  community: 'hu' | 'en'
): Promise<{ settingsId: number; players: RosterPlayer[] } | null> {
  const sql = getSql()
  const rows =
    community === 'en'
      ? await sql`SELECT id, en_players AS players FROM settings ORDER BY id ASC LIMIT 1`
      : await sql`SELECT id, players FROM settings ORDER BY id ASC LIMIT 1`
  const row = rows[0] as { id: number; players: RosterPlayer[] | null } | undefined
  if (!row) return null
  return { settingsId: row.id, players: Array.isArray(row.players) ? row.players : [] }
}

export async function writeRoster(community: 'hu' | 'en', settingsId: number, players: RosterPlayer[]): Promise<void> {
  const sql = getSql()
  const json = JSON.stringify(players)
  if (community === 'en') {
    await sql`UPDATE settings SET en_players = ${json}::jsonb WHERE id = ${settingsId}`
  } else {
    await sql`UPDATE settings SET players = ${json}::jsonb WHERE id = ${settingsId}`
  }
}

// ── Player-row matching across name-keyed imported tables (INV-02) ────────────
// favorites/bonuses/swissProfiles → payload.player; pinHashes → payload.name;
// wizard tables may carry the name only in convex_id ('hu:<player>[:matchId]').
export function rowMatchesPlayer(table: string, row: StoredRow, name: string, community: 'hu' | 'en'): boolean {
  const p = row.payload ?? {}
  const comm = (p.community ?? 'hu') as string
  switch (table) {
    case 'favorites':
    case 'bonuses':
      return p.player === name && comm === community
    case 'pinHashes':
      return p.name === name && comm === community
    case 'swissProfiles': // HU-only
      return p.player === name
    case 'wizardProfiles': // HU-only
      return p.player === name || row.convexId === `hu:${name}`
    case 'wizardPicks': // HU-only
      return (
        p.player === name ||
        row.convexId === `hu:${name}` ||
        (typeof row.convexId === 'string' && row.convexId.startsWith(`hu:${name}:`))
      )
    default:
      return false
  }
}

// Name-keyed imported tables that participate in the per-player cascade. Wizard
// and Swiss tables are HU-only, so they are skipped for community === 'en'.
export const NAME_KEYED_TABLES = ['favorites', 'bonuses', 'pinHashes'] as const
export const HU_ONLY_TABLES = ['wizardPicks', 'wizardProfiles', 'swissProfiles'] as const

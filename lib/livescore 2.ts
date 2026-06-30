import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { getSql, upsertImportedRow } from './db'
import { MATCH_BY_ID, stadiumOf } from './fixtures'
import { isKickedOff } from './engine/match-meta'

// LiveScore-API ingestion. Pulls pre-match odds + final scores and maps them to our match
// ids (group/test by hu team-name; knockout by team-pair against the authoritative koTeams
// slot assignment). Writes odds → apiCache, final scores → results (merge-upsert, INV-11).
// Knockout SLOT→TEAMS assignment is owned by koTeams, not decided here.

const LS_BASE = 'https://livescore-api.com/api-client'
const COMPS = [362, 371, 1] // WC, friendly, friendly2

const TEAM_ALIAS: Record<string, string> = {
  'Amerikai Egyesült Államok': 'Egyesült Államok',
  'Kongói Demokratikus Köztársaság (Zaire)': 'Kongói DK',
  'Zöld-foki Köztársaság': 'Zöld-foki-szigetek',
  'Dél-Korea (Koreai Köztársaság)': 'Dél-Korea'
}
const canon = (n: string) => TEAM_ALIAS[n] || n
const norm = (s: string) => (s || '').toLowerCase().normalize('NFC').trim()

// live.json gives team names as nested ENGLISH (m.home.name = "Brazil"), not the hu
// translations fixtures.json carries. Map the WC field to our canonical hu names.
const EN_HU: Record<string, string> = {
  Brazil: 'Brazília', Japan: 'Japán', Germany: 'Németország', Paraguay: 'Paraguay',
  Netherlands: 'Hollandia', Morocco: 'Marokkó', 'Ivory Coast': 'Elefántcsontpart', Norway: 'Norvégia',
  France: 'Franciaország', Sweden: 'Svédország', Mexico: 'Mexikó', Ecuador: 'Ecuador',
  England: 'Anglia', 'DR Congo': 'Kongói DK', Belgium: 'Belgium', Senegal: 'Szenegál',
  USA: 'Egyesült Államok', 'United States': 'Egyesült Államok', 'Bosnia and Herzegovina': 'Bosznia-Hercegovina',
  Spain: 'Spanyolország', Austria: 'Ausztria', Portugal: 'Portugália', Croatia: 'Horvátország',
  Switzerland: 'Svájc', Algeria: 'Algéria', Australia: 'Ausztrália', Egypt: 'Egyiptom',
  Argentina: 'Argentína', 'Cape Verde': 'Zöld-foki-szigetek', Colombia: 'Kolumbia', Ghana: 'Ghána',
  'South Africa': 'Dél-Afrika', Canada: 'Kanada', 'South Korea': 'Dél-Korea', Qatar: 'Katar',
  Uruguay: 'Uruguay', Tunisia: 'Tunézia', Iran: 'Irán', Iraq: 'Irak', Jordan: 'Jordánia',
  Uzbekistan: 'Üzbegisztán', Panama: 'Panama', Haiti: 'Haiti', Scotland: 'Skócia',
  Curacao: 'Curacao', 'New Zealand': 'Új-Zéland', 'Saudi Arabia': 'Szaúd-Arábia'
}
// Bracket path: which next-round slot each KO match feeds into (winner fills home/away).
// SF losers additionally fill the 3rd-place match (103); see advanceBracket below.
const BRACKET_PATH: Record<number, { next: number; home: boolean }> = {
  73: { next: 89, home: true },  74: { next: 89, home: false },
  75: { next: 90, home: true },  76: { next: 90, home: false },
  77: { next: 91, home: true },  78: { next: 91, home: false },
  79: { next: 92, home: true },  80: { next: 92, home: false },
  81: { next: 93, home: true },  82: { next: 93, home: false },
  83: { next: 94, home: true },  84: { next: 94, home: false },
  85: { next: 95, home: true },  86: { next: 95, home: false },
  87: { next: 96, home: true },  88: { next: 96, home: false },
  89: { next: 97, home: true },  90: { next: 97, home: false },
  91: { next: 98, home: true },  92: { next: 98, home: false },
  93: { next: 99, home: true },  94: { next: 99, home: false },
  95: { next: 100, home: true }, 96: { next: 100, home: false },
  97: { next: 101, home: true }, 98: { next: 101, home: false },
  99: { next: 102, home: true }, 100: { next: 102, home: false },
  101: { next: 104, home: true }, 102: { next: 104, home: false },
}

function winnerTeam(
  r: { h: number; a: number; penH?: number | null; penA?: number | null },
  teams: { home: string; away: string }
): string | null {
  if (r.h > r.a) return teams.home
  if (r.a > r.h) return teams.away
  if (r.penH != null && r.penA != null && r.penH !== r.penA) {
    return r.penH > r.penA ? teams.home : teams.away
  }
  return null
}

function loserTeam(
  r: { h: number; a: number; penH?: number | null; penA?: number | null },
  teams: { home: string; away: string }
): string | null {
  const w = winnerTeam(r, teams)
  if (!w) return null
  return w === teams.home ? teams.away : teams.home
}

// Pull a hu team name from a live.json side ({name} nested English) or a fixtures.json side.
function huTeamName(side: any, flat?: string): string {
  const raw = side?.translations?.hu || side?.name || flat || ''
  return canon(EN_HU[raw] || raw)
}

type Ref = { id: number; reversed: boolean }

export type PollSummary = {
  ok: boolean
  fixturesSeen: number
  oddsMapped: number
  resultsWritten: number
  unmatched: number
  ts: number
  error?: string
}

async function ls(key: string, secret: string, endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ key, secret, ...params })
  const r = await fetch(`${LS_BASE}${endpoint}?${qs}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${endpoint} HTTP ${r.status}`)
  const j = (await r.json()) as { success?: boolean; data?: any; error?: string }
  if (j.success === false) throw new Error(`${endpoint}: ${j.error ?? 'failed'}`)
  return j.data
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}
function parseScore(s: unknown): { h: number; a: number } | null {
  const m = /^\s*(\d+)\s*[-:]\s*(\d+)\s*$/.exec(String(s ?? ''))
  return m ? { h: Number(m[1]), a: Number(m[2]) } : null
}

function loadDataFixtures(): Array<{ id: number; home: string; away: string; stage: string }> {
  for (const p of [join(process.cwd(), 'public', 'classic', 'data.js'), join(process.cwd(), 'data.js')]) {
    try {
      const ctx: Record<string, any> = {}
      runInNewContext(
        readFileSync(p, 'utf8') +
          '\n;globalThis.__M__ = MATCHES.map(m => ({ id: m.id, home: m.home, away: m.away, stage: m.stage }));',
        ctx,
        { timeout: 2000 }
      )
      return ctx.__M__ ?? []
    } catch {
      // try next path
    }
  }
  return []
}

export async function runLiveScorePoll(): Promise<PollSummary> {
  const key = process.env.LS_KEY
  const secret = process.env.LS_SECRET
  if (!key || !secret) {
    return { ok: false, fixturesSeen: 0, oddsMapped: 0, resultsWritten: 0, unmatched: 0, ts: Date.now(), error: 'ls-not-configured' }
  }
  const sql = getSql()

  // Build team-pair → our match id (group/test from data.js; knockout from koTeams).
  const pairToId = new Map<string, Ref>()
  for (const m of loadDataFixtures()) {
    if (m.stage === 'ko') continue
    pairToId.set(`${norm(m.home)}::${norm(m.away)}`, { id: m.id, reversed: false })
    pairToId.set(`${norm(m.away)}::${norm(m.home)}`, { id: m.id, reversed: true })
  }
  const koRows = await sql`SELECT convex_id, payload FROM imported_rows WHERE table_name = 'koTeams'`
  for (const r of koRows as Array<{ convex_id: string; payload: any }>) {
    const p = r.payload
    if (!p?.home || !p?.away) continue
    const id = Number(r.convex_id)
    pairToId.set(`${norm(canon(p.home))}::${norm(canon(p.away))}`, { id, reversed: false })
    pairToId.set(`${norm(canon(p.away))}::${norm(canon(p.home))}`, { id, reversed: true })
  }
  const findId = (h: string, a: string) => pairToId.get(`${norm(h)}::${norm(a)}`) ?? null

  // Read existing odds and kickoffOdds so we can detect matches that just dropped from
  // the fixtures feed (= kicked off) and freeze their last-seen pre-match odds.
  let prevOddsData: Record<string, { h: number; x: number; a: number }> = {}
  let prevKickoffData: Record<string, { h: number; x: number; a: number }> = {}
  try {
    const cacheRows = await sql`
      SELECT convex_id, payload FROM imported_rows
      WHERE table_name = 'apiCache' AND convex_id IN ('odds', 'kickoffOdds')
    `
    for (const r of cacheRows as Array<{ convex_id: string; payload: any }>) {
      if (r.convex_id === 'odds') prevOddsData = r.payload?.data ?? {}
      else if (r.convex_id === 'kickoffOdds') prevKickoffData = r.payload?.data ?? {}
    }
  } catch {
    // best-effort — if we can't read, skip snapshot freeze this cycle
  }

  const oddsMap: Record<number, { h: number; x: number; a: number }> = {}
  const results: Record<number, { h: number; a: number; penH?: number; penA?: number }> = {}
  let fixturesSeen = 0
  let unmatched = 0

  try {
    for (const comp of COMPS) {
      let data
      try {
        data = await ls(key, secret, '/fixtures/matches.json', { competition_id: String(comp) })
      } catch {
        continue
      }
      for (const f of data?.fixtures ?? data ?? []) {
        fixturesSeen++
        const huHome = canon(f.home_translations?.hu || f.home_name)
        const huAway = canon(f.away_translations?.hu || f.away_name)
        const pre = f.odds?.pre
        if (!pre) continue
        const ref = findId(huHome, huAway)
        if (!ref) {
          unmatched++
          continue
        }
        const o = ref.reversed
          ? { h: num(pre['2']), x: num(pre['X']), a: num(pre['1']) }
          : { h: num(pre['1']), x: num(pre['X']), a: num(pre['2']) }
        if (o.h || o.x || o.a) oddsMap[ref.id] = o
      }
    }

    for (const comp of COMPS) {
      let data
      try {
        data = await ls(key, secret, '/matches/history.json', { competition_id: String(comp) })
      } catch {
        continue
      }
      for (const m of data?.match ?? data ?? []) {
        const ref = findId(canon(m.home_translations?.hu || m.home_name), canon(m.away_translations?.hu || m.away_name))
        if (!ref) continue
        const sc = parseScore(m.ft_score || m.score)
        if (!sc) continue
        const oriented = ref.reversed ? { h: sc.a, a: sc.h } : { h: sc.h, a: sc.a }
        // Best-effort penalty score extraction (field name varies by livescore API version)
        const penRaw = m.pen_score || m.penalty_score || m.penalties || ''
        const penSc = parseScore(penRaw)
        const penOriented = penSc
          ? ref.reversed ? { penH: penSc.a, penA: penSc.h } : { penH: penSc.h, penA: penSc.a }
          : {}
        results[ref.id] = { ...oriented, ...penOriented }
      }
    }

    // Live in-progress scores: /matches/live.json per competition. Mapped with the
    // SAME team-pair → id mapping the poll uses. These are NOT written to `results`
    // (results are full-time truth only, INV-11) — they go to a separate apiCache
    // 'live' row that player cards read for an in-play score + elapsed minute.
    const live: Record<number, { h: number; a: number; elapsed: string; status: string }> = {}
    for (const comp of COMPS) {
      let data
      try {
        data = await ls(key, secret, '/matches/live.json', { competition_id: String(comp) })
      } catch {
        continue
      }
      for (const m of data?.match ?? data ?? []) {
        const ref = findId(huTeamName(m.home, m.home_name), huTeamName(m.away, m.away_name))
        if (!ref) continue
        const sc = parseScore(m.scores?.score ?? m.score ?? m.ft_score)
        if (!sc) continue
        const oriented = ref.reversed ? { h: sc.a, a: sc.h } : { h: sc.h, a: sc.a }
        live[ref.id] = {
          h: oriented.h,
          a: oriented.a,
          elapsed: String(m.time ?? m.elapsed ?? ''),
          status: String(m.status ?? '')
        }
      }
    }

    // Freeze kickoffOdds: any match that was in the previous odds poll but is absent from
    // the new oddsMap has left the fixtures feed (typically: it kicked off and is no longer
    // listed as upcoming). Freeze its last-seen pre-match odds into a cumulative snapshot
    // that repairOdds uses as its first-priority repair source (WIZ-13).
    // The snapshot is append-only: existing entries are never overwritten.
    const updatedKickoff = { ...prevKickoffData }
    let kickoffChanged = false
    const newOddsIds = new Set(Object.keys(oddsMap).map(String))
    for (const [mid, odds] of Object.entries(prevOddsData)) {
      if (!newOddsIds.has(mid) && !(mid in updatedKickoff)) {
        updatedKickoff[mid] = odds
        kickoffChanged = true
      }
    }
    if (kickoffChanged) {
      await sql`
        INSERT INTO imported_rows (table_name, convex_id, payload)
        VALUES ('apiCache', 'kickoffOdds', ${JSON.stringify({ kind: 'kickoffOdds', ts: Date.now(), data: updatedKickoff })}::jsonb)
        ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
      `
    }

    // Write odds (recomputable cache) + final scores (merge-upsert).
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('apiCache', 'odds', ${JSON.stringify({ kind: 'odds', ts: Date.now(), data: oddsMap })}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('apiCache', 'live', ${JSON.stringify({ kind: 'live', ts: Date.now(), data: live })}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
    let resultsWritten = 0
    const now = Date.now()
    for (const [mid, r] of Object.entries(results)) {
      const matchId = Number(mid)
      // Never write a result for a match that hasn't started yet. The history feed can
      // occasionally include fixtures from other competitions whose team names collide.
      if (!isKickedOff(matchId, now)) continue
      const penH = r.penH ?? null
      const penA = r.penA ?? null
      await sql`
        INSERT INTO results (match_id, h, a, pen_h, pen_a)
        VALUES (${matchId}, ${r.h}, ${r.a}, ${penH}, ${penA})
        ON CONFLICT (match_id) DO UPDATE SET
          h = EXCLUDED.h, a = EXCLUDED.a,
          pen_h = COALESCE(EXCLUDED.pen_h, results.pen_h),
          pen_a = COALESCE(EXCLUDED.pen_a, results.pen_a)
      `
      resultsWritten++
    }

    // Auto-advance bracket: propagate confirmed winners into next-round koTeams slots.
    await advanceBracket(sql)

    return { ok: true, fixturesSeen, oddsMapped: Object.keys(oddsMap).length, resultsWritten, unmatched, ts: Date.now() }
  } catch (error) {
    return {
      ok: false,
      fixturesSeen,
      oddsMapped: Object.keys(oddsMap).length,
      resultsWritten: 0,
      unmatched,
      ts: Date.now(),
      error: error instanceof Error ? error.message : 'unknown'
    }
  }
}

// ── Bracket auto-advance ─────────────────────────────────────────────────────
// Scans all KO results and propagates each confirmed winner into the next-round
// koTeams slot. Processing in ascending matchId order enables single-pass cascade
// (R32 winners fill R16 slots which then feed QF slots in the same call).
// A slot with `confirmed: true` is considered manually verified and is never overwritten.
async function advanceBracket(sql: ReturnType<typeof getSql>): Promise<void> {
  const resultRows = await sql`
    SELECT match_id, h, a, pen_h AS "penH", pen_a AS "penA"
    FROM results
    WHERE match_id >= 73 AND match_id <= 104
    ORDER BY match_id ASC
  `
  if (!(resultRows as any[]).length) return

  const koRows = await sql`
    SELECT convex_id, payload FROM imported_rows
    WHERE table_name = 'koTeams'
    ORDER BY convex_id::integer ASC
  `
  const koMap = new Map<number, Record<string, any>>()
  for (const r of koRows as Array<{ convex_id: string; payload: any }>) {
    const id = Number(r.convex_id)
    if (r.payload?.home && r.payload?.away) koMap.set(id, r.payload)
  }

  for (const row of resultRows as any[]) {
    const matchId = Number(row.match_id)
    const teams = koMap.get(matchId)
    if (!teams) continue

    const r = { h: Number(row.h), a: Number(row.a), penH: row.penH, penA: row.penA }
    const path = BRACKET_PATH[matchId]

    // Winner → next-round slot
    if (path) {
      const winner = winnerTeam(r, teams as any)
      if (winner) {
        const nextId = path.next
        const existing = koMap.get(nextId) ?? {}
        if (existing.confirmed) continue
        const updated = { ...existing, [path.home ? 'home' : 'away']: winner }
        await sql`
          INSERT INTO imported_rows (table_name, convex_id, payload)
          VALUES ('koTeams', ${String(nextId)}, ${JSON.stringify(updated)}::jsonb)
          ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
        `
        koMap.set(nextId, updated)
      }
    }

    // SF losers → 3rd-place match (103)
    if (matchId === 101 || matchId === 102) {
      const loser = loserTeam(r, teams as any)
      if (loser) {
        const isHome = matchId === 101
        const ex103 = koMap.get(103) ?? {}
        if (!ex103.confirmed) {
          const upd103 = { ...ex103, [isHome ? 'home' : 'away']: loser }
          await sql`
            INSERT INTO imported_rows (table_name, convex_id, payload)
            VALUES ('koTeams', '103', ${JSON.stringify(upd103)}::jsonb)
            ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
          `
          koMap.set(103, upd103)
        }
      }
    }
  }
}

// ── Per-match centre (events + lineups + odds) ──────────────────────────────
// Powers the match-detail modal tabs. Resolves OUR match id → the feed's apiId by
// matching the hu team-name pair against the live/history/fixtures feeds (same
// mapping runLiveScorePoll uses), then pulls single.json + scores/events.json.

export type MatchEvent = { minute: string; type: string; player: string; sub?: string; team: 'h' | 'a' }
export type LineupPlayer = { num: string; name: string }
export type MatchCentre = {
  events: MatchEvent[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] } | null
  odds: { h: number; x: number; a: number } | null
  status: string
  venue: string | null
  htScore: { h: number; a: number } | null
}

// LiveScore event keyword → normalised type the modal renders an icon for.
const EVENT_TYPE: Record<string, string> = {
  GOAL: 'goal',
  GOAL_PENALTY: 'goal_penalty',
  PENALTY: 'goal_penalty',
  OWN_GOAL: 'own_goal',
  YELLOW_CARD: 'yellow',
  RED_CARD: 'red',
  YELLOW_RED_CARD: 'yellow_red',
  SUBSTITUTION: 'sub',
  MISSED_PENALTY: 'missed_penalty'
}

// is_home/is_away arrive as booleans in the docs but "1"/"0" strings in the live feed.
function evTruthy(x: unknown): boolean {
  return x === true || x === 1 || x === '1' || x === 'true'
}
function evSide(e: any): 'h' | 'a' {
  if (evTruthy(e.is_away)) return 'a'
  if (evTruthy(e.is_home)) return 'h'
  return String(e.home_away || e.side || '').toLowerCase().startsWith('a') ? 'a' : 'h'
}

function teamNameOf(t: any): string {
  if (!t) return ''
  if (typeof t === 'string') return t
  return t.name || t.team_name || t.short_name || ''
}
function huHomeName(m: any): string {
  return m?.home_translations?.hu || m?.home_name || teamNameOf(m?.home) || m?.localteam_name || ''
}
function huAwayName(m: any): string {
  return m?.away_translations?.hu || m?.away_name || teamNameOf(m?.away) || m?.visitorteam_name || ''
}
function listOf(data: any): any[] {
  return data?.match ?? data?.matches ?? data?.fixtures ?? (Array.isArray(data) ? data : []) ?? []
}

// Resolve our match's hu team names: group/test from fixtures, knockout from koTeams.
async function ourTeamNames(matchId: number): Promise<{ home: string; away: string } | null> {
  const fx = MATCH_BY_ID[matchId]
  if (!fx) return null
  if (fx.stage === 'ko') {
    const sql = getSql()
    const rows = await sql`SELECT payload FROM imported_rows WHERE table_name = 'koTeams' AND convex_id = ${String(matchId)} LIMIT 1`
    const ko = (rows as Array<{ payload: any }>)[0]?.payload
    if (ko?.home && ko?.away) return { home: ko.home, away: ko.away }
    return null // KO slot still a placeholder ("A2.") — can't match the feed yet
  }
  return { home: fx.home, away: fx.away }
}

// Find the feed apiId for our match by scanning live → history → fixtures across
// every competition. reversed=true means the feed's home/away are swapped vs ours.
async function resolveApiId(
  matchId: number,
  key: string,
  secret: string
): Promise<{ apiId: string; reversed: boolean } | null> {
  const teams = await ourTeamNames(matchId)
  if (!teams) return null
  const target = `${norm(canon(teams.home))}::${norm(canon(teams.away))}`
  const targetRev = `${norm(canon(teams.away))}::${norm(canon(teams.home))}`
  for (const endpoint of ['/matches/live.json', '/matches/history.json', '/fixtures/matches.json']) {
    for (const comp of COMPS) {
      let data
      try {
        data = await ls(key, secret, endpoint, { competition_id: String(comp) })
      } catch {
        continue
      }
      for (const f of listOf(data)) {
        const apiId = String(f.id || f.fixture_id || f.match_id || '')
        if (!apiId) continue
        const pair = `${norm(canon(huHomeName(f)))}::${norm(canon(huAwayName(f)))}`
        if (pair === target) return { apiId, reversed: false }
        if (pair === targetRev) return { apiId, reversed: true }
      }
    }
  }
  return null
}

function parseEvents(data: any, reversed: boolean): MatchEvent[] {
  const raw: any[] = data?.event ?? data?.events ?? []
  const out: Array<{ ev: MatchEvent; sort: number }> = []
  raw.forEach((e, i) => {
    const key = String(e.event || e.type || '').toUpperCase().trim()
    const type = EVENT_TYPE[key]
    if (!type) return
    const player = typeof e.player === 'string' ? e.player : e.player?.name || e.player_name || ''
    const sub = typeof e.info === 'object' && e.info
      ? (e.info.name || '')
      : (e.player_2 || e.substitute || '')
    let team = evSide(e)
    if (reversed) team = team === 'h' ? 'a' : 'h'
    const ev: MatchEvent = { minute: String(e.time ?? e.minute ?? ''), type, player, team }
    if (sub) ev.sub = String(sub)
    out.push({ ev, sort: Number(e.sort ?? i) })
  })
  return out.sort((a, b) => a.sort - b.sort).map((x) => x.ev)
}

// data.lineup.{home,away}.players[] — keep the starting XI (substitution "0").
function parseLineupSide(side: any): LineupPlayer[] {
  const players: any[] = side?.players || []
  const starters = players.filter((p) => String(p.substitution ?? '0') === '0')
  const pick = starters.length ? starters : players
  return pick.map((p) => ({ num: String(p.shirt_number ?? p.number ?? ''), name: String(p.name || '') }))
}
function parseLineups(...sources: any[]): MatchCentre['lineups'] {
  for (const data of sources) {
    const lu = data?.lineup || data?.match?.lineup || data?.lineups
    if (!lu?.home && !lu?.away) continue
    const home = parseLineupSide(lu.home)
    const away = parseLineupSide(lu.away)
    if (home.length || away.length) return { home, away }
  }
  return null
}

// Pre-match odds already cached by runLiveScorePoll under apiCache 'odds'.
async function readCachedOdds(matchId: number): Promise<MatchCentre['odds']> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT payload FROM imported_rows WHERE table_name = 'apiCache' AND convex_id = 'odds' LIMIT 1`
    const cache = (rows as Array<{ payload: any }>)[0]?.payload?.data as Record<string, any> | undefined
    const o = cache?.[String(matchId)]
    if (o && o.h && o.x && o.a) return { h: Number(o.h), x: Number(o.x), a: Number(o.a) }
  } catch {
    // best-effort
  }
  return null
}

// Build the full match-centre payload for one of OUR match ids. Never throws:
// returns empty events / null lineups when LS is unconfigured or the match can't
// be resolved, so the modal degrades gracefully.
export async function fetchMatchCentre(matchId: number): Promise<MatchCentre> {
  const odds = await readCachedOdds(matchId)
  const key = process.env.LS_KEY
  const secret = process.env.LS_SECRET
  if (!key || !secret) return { events: [], lineups: null, odds, status: '' }

  let ref: { apiId: string; reversed: boolean } | null = null
  try {
    ref = await resolveApiId(matchId, key, secret)
  } catch {
    ref = null
  }
  if (!ref) return { events: [], lineups: null, odds, status: '' }

  let single: any = null
  let eventsData: any = null
  try {
    single = await ls(key, secret, '/matches/single.json', { id: ref.apiId })
  } catch {
    single = null
  }
  try {
    eventsData = await ls(key, secret, '/scores/events.json', { id: ref.apiId })
  } catch {
    eventsData = null
  }

  const matchObj = single?.match ?? (Array.isArray(single) ? single[0] : single) ?? null
  const status = String(matchObj?.status || matchObj?.time || '')
  const events = parseEvents(eventsData ?? single ?? {}, ref.reversed)
  let lineups = parseLineups(single, single?.match, eventsData)
  if (lineups && ref.reversed) lineups = { home: lineups.away, away: lineups.home }

  return { events, lineups, odds, status }
}

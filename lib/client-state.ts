import { encodeClientKey } from './keys'
import { computeAllScores, computeRankings } from './engine/scoring'
import { computeWizardScores, computeWizardRankings, repairOdds, pickFromScore } from './engine/wizard'
import { computeSwiss } from './engine/swiss'
import { SWISS_ROUNDS } from './engine/match-meta'
import type {
  Bonus,
  Favorite,
  KoTeam,
  OddsSnapshot,
  Pick1X2,
  PlayerEntry,
  Prediction,
  Result,
  SwissPairing,
  SwissProfile,
  WizardPick,
  WizardProfile
} from './engine/types'

type Row = Record<string, any>
type Tables = Record<string, Row[] | undefined>

export type PublicStateOptions = {
  community?: string
}

export { encodeClientKey }

export function buildPublicState(tables: Tables, options: PublicStateOptions = {}) {
  const community = options.community ?? 'hu'
  const isEnglish = community === 'en'
  const settingsRow = first(tables.settings) ?? { leagues: ['Alapliga'], players: [] }
  const derived = computeDerivedRows(tables)
  const scoreRows = derived.playerScores.length ? derived.playerScores : tables.playerScores
  const rankingRows = derived.rankings.length ? derived.rankings : tables.rankings
  const {
    enPlayers: _enPlayers,
    ls2Key: _ls2Key,
    ls2Secret: _ls2Secret,
    adminTotp: _adminTotp,
    ...settingsRest
  } = settingsRow

  const settings = {
    ...settingsRest,
    players: isEnglish ? (settingsRow.enPlayers ?? []) : (settingsRow.players ?? []),
    leagues: isEnglish ? ['Mindenki'] : (settingsRow.leagues ?? ['Alapliga']),
    landingSkin: settingsRow.landingSkin === 'classic' ? 'classic' : 'matchday',
    newsBoard: Array.isArray(settingsRow.newsBoard) ? settingsRow.newsBoard : [],
    hasLsKey: Boolean(settingsRow.ls2Key && settingsRow.ls2Secret)
  }

  // Extract per-match events and half-time scores from cached events_<matchId> rows.
  const matchEvents: Record<
    string,
    Array<{ minute: string; type: string; player: string; sub?: string; team: 'h' | 'a' }>
  > = {}
  const matchScores: Record<string, { ht?: { h: number; a: number } }> = {}
  for (const row of tables.apiCache ?? []) {
    if (typeof row.kind === 'string' && row.kind.startsWith('events_')) {
      const matchId = row.kind.slice('events_'.length)
      if (Array.isArray(row.data?.events) && row.data.events.length > 0) {
        matchEvents[matchId] = row.data.events
      }
      if (row.data?.htScore) {
        matchScores[matchId] = { ht: row.data.htScore }
      }
    }
  }

  return {
    settings,
    predictions: groupRows(tables.predictions, community, (row) => [
      row.player,
      row.matchId,
      { h: row.h, a: row.a }
    ]),
    results: mapRows(tables.results, (row) => [
      row.matchId,
      withDefined({ h: row.h, a: row.a, pen_h: row.pen_h, pen_a: row.pen_a })
    ]),
    koTeams: mapRows(tables.koTeams, (row) => [
      row.matchId,
      withDefined({
        home: row.home,
        away: row.away,
        confirmed: row.confirmed,
        auto: row.auto,
        autoNote: row.autoNote
      })
    ]),
    bonuses: groupListRows(tables.bonuses, community, (row) => [
      row.player,
      { pts: row.pts, reason: row.reason }
    ]),
    favorites: mapCommunityRows(tables.favorites, community, (row) => [
      row.player,
      {
        team: row.team,
        switched: row.switched,
        newTeam: row.newTeam ?? null,
        pendingKO: row.pendingKO ?? false
      }
    ]),
    _txnlog: mapRows(tables.txnlog, (row) => [
      row._id ?? `${row.ts}:${row.label}`,
      pick(row, ['ts', 'who', 'type', 'label', 'path'])
    ]),
    apiCache: mapRows(tables.apiCache, (row) => [row.kind, { ts: row.ts, data: row.data }]),
    scores: mapCommunityRows(scoreRows, community, (row) => [
      row.player,
      pick(row, [
        'pts',
        'matchPts',
        'bonus',
        'exact',
        'counted',
        'predicted',
        'totalR',
        'ppg',
        'byScope',
        'byMatch'
      ])
    ]),
    rankings: rankingsForCommunity(rankingRows, isEnglish),
    wizardPicks: groupRows(tables.wizardPicks, 'hu', (row) => [
      row.player,
      row.matchId,
      { pick: row.pick, oddsAtPick: row.oddsAtPick }
    ]),
    wizardProfiles: mapEncodedRows(tables.wizardProfiles, (row) => [
      row.player,
      { active: row.active, mirror: row.mirror }
    ]),
    wizardRankings: computeLiveWizardRankings(tables),
    swissProfiles: isEnglish
      ? []
      : (tables.swissProfiles ?? []).map((row) =>
          pick(row, ['player', 'active', 'joinedRound', 'removedAtRound'])
        ),
    swissPairings: isEnglish
      ? []
      : (tables.swissPairings ?? []).map((row) =>
          pick(row, ['round', 'a', 'b', 'tier', 'slot', 'publishedBy'])
        ),
    swiss: isEnglish ? null : computeLiveSwiss(tables),
    swissLog: isEnglish
      ? []
      : (tables.swissLog ?? []).map((row) => pick(row, ['ts', 'who', 'action', 'rounds', 'note'])),
    matchEvents,
    matchScores
  }
}

// Score + rank every player by delegating to the pure engine (single source of truth:
// engine/scoring + MATCH_META). No in-file scoring copy — the engine is unit-tested and
// shared with the rest of the app.
function computeDerivedRows(tables: Tables) {
  const settings = first(tables.settings)
  if (!settings) return { playerScores: [] as Row[], rankings: [] as Row[] }

  const predictions = mapPredictions(tables)
  const results = mapResults(tables)
  const bonuses = mapBonuses(tables)
  const favorites = mapFavorites(tables)
  const koTeams = mapKoTeams(tables)

  const huPlayers = toPlayerEntries(settings.players)
  const enPlayers = toPlayerEntries(settings.enPlayers)

  const huScores = computeAllScores(huPlayers, 'hu', predictions, results, bonuses, favorites, koTeams)
  const enScores = enPlayers.length
    ? computeAllScores(enPlayers, 'en', predictions, results, bonuses, favorites, koTeams)
    : []
  const playerScores = [...huScores, ...enScores] as unknown as Row[]

  const leagues = Array.isArray(settings.leagues) ? (settings.leagues as string[]) : []
  const huRankings = computeRankings(huPlayers, leagues, huScores, 'hu')
  const enRankings = enPlayers.length ? computeRankings(enPlayers, [], enScores, 'en') : []

  return { playerScores, rankings: [...huRankings, ...enRankings] as unknown as Row[] }
}

function toPlayerEntries(players: unknown): PlayerEntry[] {
  if (!Array.isArray(players)) return []
  return players
    .filter((p) => p && p.name)
    .map((p) => ({
      name: p.name as string,
      leagues: Array.isArray(p.leagues) ? (p.leagues as string[]) : []
    }))
}

function mapPredictions(tables: Tables): Prediction[] {
  const out: Prediction[] = []
  for (const row of tables.predictions ?? []) {
    const matchId = Number(row.matchId)
    if (!Number.isInteger(matchId)) continue
    out.push({ player: row.player, matchId, h: Number(row.h), a: Number(row.a), community: communityOf(row) })
  }
  return out
}

function mapBonuses(tables: Tables): Bonus[] {
  return (tables.bonuses ?? [])
    .filter((row) => row.player)
    .map((row) => ({
      player: row.player,
      pts: Number(row.pts ?? 0),
      reason: row.reason ?? '',
      community: communityOf(row)
    }))
}

function mapFavorites(tables: Tables): Favorite[] {
  return (tables.favorites ?? [])
    .filter((row) => row.player)
    .map((row) => ({
      player: row.player,
      team: row.team ?? '',
      switched: Boolean(row.switched),
      newTeam: row.newTeam ?? null,
      pendingKO: Boolean(row.pendingKO),
      community: communityOf(row)
    }))
}

function mapKoTeams(tables: Tables): KoTeam[] {
  return (tables.koTeams ?? [])
    .filter((row) => Number.isInteger(Number(row.matchId)))
    .map((row) => ({
      matchId: Number(row.matchId),
      home: row.home ?? '',
      away: row.away ?? '',
      confirmed: row.confirmed,
      auto: row.auto
    }))
}

// ── Live Wizard of ODDS ranking (engine-backed) ─────────────────────────────
// Replaces the frozen wizardRankings snapshot. Scores are computed every read
// from picks + results via the spec-faithful engine (repairOdds →
// computeWizardScores → computeWizardRankings). Mirror ("Varázslótanonc")
// players get a derived 1/X/2 pick from their score prediction for any WC match
// they predicted but have no explicit pick for.
function computeLiveWizardRankings(tables: Tables) {
  const settings = first(tables.settings)
  const players: Row[] = settings?.players ?? []

  const results: Result[] = mapResults(tables)

  const profileByPlayer = new Map<string, { active: boolean; mirror: boolean }>()
  for (const row of tables.wizardProfiles ?? []) {
    if (!row.player) continue
    profileByPlayer.set(row.player, { active: row.active !== false, mirror: row.mirror !== false })
  }

  // Stored picks (HU only). These already carry oddsAtPick from pick time.
  const stored: WizardPick[] = []
  const storedKey = new Set<string>()
  for (const row of tables.wizardPicks ?? []) {
    if ((row.community ?? 'hu') !== 'hu') continue
    if (!row.player || row.matchId == null || !row.pick) continue
    const matchId = Number(row.matchId)
    stored.push({
      player: row.player,
      matchId,
      pick: row.pick as Pick1X2,
      oddsAtPick: Number(row.oddsAtPick ?? 0) || 0,
      oddsSource: row.oddsSource,
      lockedAt: row.lockedAt
    })
    storedKey.add(`${row.player}|${matchId}`)
  }

  // Mirror gap-fill: derive picks from HU predictions for mirror-on players.
  const predsByPlayer = new Map<string, Map<number, { h: number; a: number }>>()
  for (const row of tables.predictions ?? []) {
    if ((row.community ?? 'hu') !== 'hu') continue
    const matchId = Number(row.matchId)
    if (!predsByPlayer.has(row.player)) predsByPlayer.set(row.player, new Map())
    predsByPlayer.get(row.player)!.set(matchId, { h: Number(row.h), a: Number(row.a) })
  }
  const mirrored: WizardPick[] = []
  for (const player of players) {
    const name = player.name
    if (!name) continue
    const prof = profileByPlayer.get(name)
    // Classic parity: missing wizardProfiles row means "not joined"; mirror only
    // defaults to on after the player joins the league.
    const active = prof ? prof.active : false
    const mirror = prof ? prof.mirror : true
    if (!active || !mirror) continue
    const preds = predsByPlayer.get(name)
    if (!preds) continue
    for (const [matchId, p] of preds) {
      if (matchId >= 999) continue // WC-only league (WIZ-07)
      if (storedKey.has(`${name}|${matchId}`)) continue
      mirrored.push({ player: name, matchId, pick: pickFromScore(p.h, p.a), oddsAtPick: 0, lockedAt: 0 })
    }
  }

  // Odds repair snapshots come from apiCache (kickoffOdds = frozen, odds = live).
  // The cache stores per-match odds as {h, x, a}, but the engine's OddsSnapshot
  // expects {home, draw, away} — adapt the shape so the repair chain actually
  // reads real odds instead of always falling through to the 1.10 floor.
  let kickoffSnapshot: OddsSnapshot = {}
  let oddsCache: OddsSnapshot = {}
  for (const row of tables.apiCache ?? []) {
    if (row.kind === 'kickoffOdds' && row.data) kickoffSnapshot = toOddsSnapshot(row.data)
    else if (row.kind === 'odds' && row.data) oddsCache = toOddsSnapshot(row.data)
  }

  const profiles: WizardProfile[] = players
    .filter((row) => row.name)
    .map((row) => {
      const prof = profileByPlayer.get(row.name)
      return { player: row.name, active: prof ? prof.active : false, mirror: prof ? prof.mirror : true }
    })

  const repaired = repairOdds([...stored, ...mirrored], results, kickoffSnapshot, oddsCache)
  const scores = computeWizardScores(repaired, results, profiles)
  const ranking = computeWizardRankings(scores, profiles)

  return ranking.map((r, i) => ({
    name: r.name,
    place: i + 1,
    pts: r.pts,
    accuracy: r.accuracy,
    played: r.played
  }))
}

// ── Live Swiss / Párbaj standings (engine-backed) ───────────────────────────
// Replaces the frozen swissStandings snapshot. computeSwiss derives match points,
// records, predicted-points and Buchholz from the authoritative swissProfiles +
// swissPairings + predictions + results inputs on every read.
function computeLiveSwiss(tables: Tables) {
  const profiles: SwissProfile[] = (tables.swissProfiles ?? [])
    .filter((row) => row.player)
    .map((row) => ({
      player: row.player,
      active: row.active !== false,
      joinedRound: row.joinedRound,
      removedAtRound: row.removedAtRound ?? null
    }))

  const pairings: SwissPairing[] = (tables.swissPairings ?? [])
    .filter((row) => row.round != null && row.a)
    .map((row) => ({
      round: Number(row.round),
      a: row.a,
      b: row.b ?? null,
      tier: row.tier ?? undefined,
      slot: row.slot ?? undefined
    }))

  const predictions: Prediction[] = (tables.predictions ?? [])
    .filter((row) => (row.community ?? 'hu') === 'hu')
    .map((row) => ({
      player: row.player,
      matchId: Number(row.matchId),
      h: Number(row.h),
      a: Number(row.a),
      community: 'hu'
    }))

  const results = mapResults(tables)
  const out = computeSwiss(profiles, pairings, predictions, results)

  const standings = out.standings.map((s) => ({
    name: s.name,
    mp: s.mp,
    w: s.w,
    d: s.d,
    l: s.l,
    place: s.place,
    predPts: s.base,
    buchholz: s.bh
  }))

  // Current round = first round with an unfinished match, else 13.
  const resultIds = new Set(results.map((r) => r.matchId))
  let round = 13
  for (let r = 1; r <= 13; r++) {
    if ((SWISS_ROUNDS[r - 1] ?? []).some((id) => !resultIds.has(id))) {
      round = r
      break
    }
  }
  // Standings freeze once round 10 (SWISS_ROUNDS index 9) is fully resulted.
  const frozen =
    (SWISS_ROUNDS[9] ?? []).length > 0 && (SWISS_ROUNDS[9] ?? []).every((id) => resultIds.has(id))

  return { standings, round, frozen }
}

// Adapt the live/kickoff odds cache ({matchId: {h, x, a}}) to the engine's
// OddsSnapshot shape ({matchId: {home, draw, away}}). Tolerant of either field
// naming so an already-converted snapshot passes through unchanged.
function toOddsSnapshot(data: unknown): OddsSnapshot {
  const out: OddsSnapshot = {}
  if (!data || typeof data !== 'object') return out
  for (const [matchId, raw] of Object.entries(data as Record<string, any>)) {
    if (!raw || typeof raw !== 'object') continue
    const home = Number(raw.home ?? raw.h)
    const draw = Number(raw.draw ?? raw.x)
    const away = Number(raw.away ?? raw.a)
    out[matchId] = {
      home: Number.isFinite(home) ? home : 0,
      draw: Number.isFinite(draw) ? draw : 0,
      away: Number.isFinite(away) ? away : 0
    }
  }
  return out
}

function mapResults(tables: Tables): Result[] {
  const out: Result[] = []
  for (const row of tables.results ?? []) {
    const matchId = Number(row.matchId)
    if (!Number.isInteger(matchId)) continue
    out.push({ matchId, h: Number(row.h), a: Number(row.a), pen_h: row.pen_h, pen_a: row.pen_a })
  }
  return out
}

function first(rows: Row[] | undefined) {
  return rows?.[0]
}

function communityOf(row: Row) {
  return row.community ?? 'hu'
}

function groupRows(
  rows: Row[] | undefined,
  community: string,
  select: (row: Row) => [string, string | number, unknown]
) {
  const out: Record<string, Record<string, unknown>> = {}
  for (const row of rows ?? []) {
    if (communityOf(row) !== community) continue
    const [owner, key, value] = select(row)
    ;(out[encodeClientKey(owner)] ??= {})[String(key)] = value
  }
  return out
}

function groupListRows(rows: Row[] | undefined, community: string, select: (row: Row) => [string, unknown]) {
  const out: Record<string, unknown[]> = {}
  for (const row of rows ?? []) {
    if (communityOf(row) !== community) continue
    const [owner, value] = select(row)
    ;(out[encodeClientKey(owner)] ??= []).push(value)
  }
  return out
}

function mapRows(rows: Row[] | undefined, select: (row: Row) => [string | number, unknown]) {
  const out: Record<string, unknown> = {}
  for (const row of rows ?? []) {
    const [key, value] = select(row)
    out[String(key)] = value
  }
  return out
}

function mapCommunityRows(
  rows: Row[] | undefined,
  community: string,
  select: (row: Row) => [string | number, unknown]
) {
  return mapEncodedRows(
    (rows ?? []).filter((row) => communityOf(row) === community),
    select
  )
}

function mapEncodedRows(rows: Row[] | undefined, select: (row: Row) => [string | number, unknown]) {
  const out: Record<string, unknown> = {}
  for (const row of rows ?? []) {
    const [key, value] = select(row)
    out[encodeClientKey(String(key))] = value
  }
  return out
}

function rankingsForCommunity(rows: Row[] | undefined, isEnglish: boolean) {
  const out: Record<string, unknown> = {}
  for (const row of rows ?? []) {
    const key = String(row.scopeLeague)
    if (isEnglish && key.startsWith('en_')) out[encodeClientKey(key.slice(3))] = row.rows
    if (!isEnglish && !key.startsWith('en_')) out[encodeClientKey(key)] = row.rows
  }
  return out
}

function pick(row: Row, keys: string[]) {
  return withDefined(Object.fromEntries(keys.map((key) => [key, row[key]])))
}

function withDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>
}

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { encodeClientKey } from './keys'
import { computeWizardScores, computeWizardRankings, repairOdds, pickFromScore } from './engine/wizard'
import { computeSwiss } from './engine/swiss'
import { SWISS_ROUNDS } from './engine/match-meta'
import type {
  OddsSnapshot,
  Pick1X2,
  Prediction,
  Result,
  SwissPairing,
  SwissProfile,
  WizardPick,
  WizardProfile,
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
  const { enPlayers: _enPlayers, ls2Key: _ls2Key, ls2Secret: _ls2Secret, adminTotp: _adminTotp, ...settingsRest } =
    settingsRow

  const settings = {
    ...settingsRest,
    players: isEnglish ? settingsRow.enPlayers ?? [] : settingsRow.players ?? [],
    leagues: isEnglish ? ['Mindenki'] : settingsRow.leagues ?? ['Alapliga'],
    landingSkin: settingsRow.landingSkin === 'classic' ? 'classic' : 'matchday',
    newsBoard: Array.isArray(settingsRow.newsBoard) ? settingsRow.newsBoard : [],
    hasLsKey: Boolean(settingsRow.ls2Key && settingsRow.ls2Secret)
  }

  return {
    settings,
    predictions: groupRows(tables.predictions, community, (row) => [row.player, row.matchId, { h: row.h, a: row.a }]),
    results: mapRows(tables.results, (row) => [row.matchId, withDefined({ h: row.h, a: row.a, pen_h: row.pen_h, pen_a: row.pen_a })]),
    koTeams: mapRows(tables.koTeams, (row) => [
      row.matchId,
      withDefined({ home: row.home, away: row.away, confirmed: row.confirmed, auto: row.auto, autoNote: row.autoNote })
    ]),
    bonuses: groupListRows(tables.bonuses, community, (row) => [row.player, { pts: row.pts, reason: row.reason }]),
    favorites: mapCommunityRows(tables.favorites, community, (row) => [
      row.player,
      { team: row.team, switched: row.switched, newTeam: row.newTeam ?? null, pendingKO: row.pendingKO ?? false }
    ]),
    _txnlog: mapRows(tables.txnlog, (row) => [row._id ?? `${row.ts}:${row.label}`, pick(row, ['ts', 'who', 'type', 'label', 'path'])]),
    apiCache: mapRows(tables.apiCache, (row) => [row.kind, { ts: row.ts, data: row.data }]),
    scores: mapCommunityRows(scoreRows, community, (row) => [
      row.player,
      pick(row, ['pts', 'matchPts', 'bonus', 'exact', 'counted', 'predicted', 'totalR', 'ppg', 'byScope', 'byMatch'])
    ]),
    rankings: rankingsForCommunity(rankingRows, isEnglish),
    wizardPicks: groupRows(tables.wizardPicks, 'hu', (row) => [
      row.player,
      row.matchId,
      { pick: row.pick, oddsAtPick: row.oddsAtPick }
    ]),
    wizardProfiles: mapEncodedRows(tables.wizardProfiles, (row) => [row.player, { active: row.active, mirror: row.mirror }]),
    wizardRankings: computeLiveWizardRankings(tables),
    swissProfiles: isEnglish ? [] : (tables.swissProfiles ?? []).map((row) => pick(row, ['player', 'active', 'joinedRound', 'removedAtRound'])),
    swissPairings: isEnglish ? [] : (tables.swissPairings ?? []).map((row) => pick(row, ['round', 'a', 'b', 'tier', 'slot', 'publishedBy'])),
    swiss: isEnglish ? null : computeLiveSwiss(tables),
    swissLog: isEnglish ? [] : (tables.swissLog ?? []).map((row) => pick(row, ['ts', 'who', 'action', 'rounds', 'note']))
  }
}

function computeDerivedRows(tables: Tables) {
  const settings = first(tables.settings)
  if (!settings) return { playerScores: [] as Row[], rankings: [] as Row[] }

  const matchMeta = loadMatchMeta()
  if (!matchMeta.size) return { playerScores: [] as Row[], rankings: [] as Row[] }

  const koByMatch = new Map<number, Row>()
  for (const row of tables.koTeams ?? []) koByMatch.set(Number(row.matchId), row)

  const enrichedMeta = new Map<number, MatchMeta>()
  for (const [id, meta] of matchMeta) {
    const ko = koByMatch.get(id)
    enrichedMeta.set(id, {
      ...meta,
      home: meta.stage === 'ko' ? ko?.home ?? meta.home : meta.home,
      away: meta.stage === 'ko' ? ko?.away ?? meta.away : meta.away
    })
  }

  const playerScores = [
    ...scoreCommunity(settings.players ?? [], 'hu', tables, enrichedMeta),
    ...scoreCommunity(settings.enPlayers ?? [], 'en', tables, enrichedMeta)
  ]

  return {
    playerScores,
    rankings: rankCommunities(settings, playerScores)
  }
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
      lockedAt: row.lockedAt,
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
    const active = prof ? prof.active : true
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

  const profiles: WizardProfile[] = (tables.wizardProfiles ?? [])
    .filter((row) => row.player)
    .map((row) => ({ player: row.player, active: row.active !== false, mirror: row.mirror !== false }))

  const repaired = repairOdds([...stored, ...mirrored], results, kickoffSnapshot, oddsCache)
  const scores = computeWizardScores(repaired, results, profiles)
  const ranking = computeWizardRankings(scores, profiles)

  return ranking.map((r, i) => ({
    name: r.name,
    place: i + 1,
    pts: r.pts,
    accuracy: r.accuracy,
    played: r.played,
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
      removedAtRound: row.removedAtRound ?? null,
    }))

  const pairings: SwissPairing[] = (tables.swissPairings ?? [])
    .filter((row) => row.round != null && row.a)
    .map((row) => ({
      round: Number(row.round),
      a: row.a,
      b: row.b ?? null,
      tier: row.tier ?? undefined,
      slot: row.slot ?? undefined,
    }))

  const predictions: Prediction[] = (tables.predictions ?? [])
    .filter((row) => (row.community ?? 'hu') === 'hu')
    .map((row) => ({ player: row.player, matchId: Number(row.matchId), h: Number(row.h), a: Number(row.a), community: 'hu' }))

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
    buchholz: s.bh,
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
  const frozen = (SWISS_ROUNDS[9] ?? []).length > 0 && (SWISS_ROUNDS[9] ?? []).every((id) => resultIds.has(id))

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

type MatchMeta = { id: number; stage: 'group' | 'ko' | 'test'; home: string; away: string }

let matchMetaCache: Map<number, MatchMeta> | null = null

function loadMatchMeta() {
  if (matchMetaCache) return matchMetaCache

  for (const candidate of dataFileCandidates()) {
    if (!existsSync(candidate)) continue
    try {
      const context: Record<string, any> = {}
      runInNewContext(
        `${readFileSync(candidate, 'utf8')}\n;globalThis.__MATCHES__ = MATCHES.map(({ id, stage, home, away }) => ({ id, stage, home, away }));`,
        context,
        { timeout: 1000 }
      )
      const matches = Array.isArray(context.__MATCHES__) ? context.__MATCHES__ : []
      matchMetaCache = new Map(
        matches
          .filter((match) => Number.isInteger(match.id) && ['group', 'ko', 'test'].includes(match.stage))
          .map((match) => [
            Number(match.id),
            { id: Number(match.id), stage: match.stage, home: String(match.home ?? ''), away: String(match.away ?? '') }
          ])
      )
      return matchMetaCache
    } catch {
      // Try the next candidate path.
    }
  }

  matchMetaCache = new Map()
  return matchMetaCache
}

function dataFileCandidates() {
  const cwd = process.cwd()
  return [
    join(cwd, 'public', 'classic', 'data.js'),
    join(cwd, 'apps', 'rewrite', 'public', 'classic', 'data.js'),
    join(cwd, 'data.js'),
    join(cwd, '..', '..', 'data.js')
  ]
}

function scoreCommunity(players: Row[], community: string, tables: Tables, matchMeta: Map<number, MatchMeta>) {
  if (!players.length) return []

  const results = new Map<number, Row>()
  for (const row of tables.results ?? []) {
    if (Number.isInteger(Number(row.matchId))) results.set(Number(row.matchId), row)
  }

  const predictions = new Map<string, Map<number, Row>>()
  for (const row of tables.predictions ?? []) {
    if (communityOf(row) !== community) continue
    if (!predictions.has(row.player)) predictions.set(row.player, new Map())
    predictions.get(row.player)!.set(Number(row.matchId), row)
  }

  const bonusByPlayer = new Map<string, number>()
  for (const row of tables.bonuses ?? []) {
    if (communityOf(row) !== community) continue
    bonusByPlayer.set(row.player, (bonusByPlayer.get(row.player) ?? 0) + Number(row.pts ?? 0))
  }

  const favoriteByPlayer = new Map<string, Row>()
  for (const row of tables.favorites ?? []) {
    if (communityOf(row) === community) favoriteByPlayer.set(row.player, row)
  }

  const scopes = buildScopeSets(matchMeta)
  const scoreRows: Row[] = []
  for (const player of players) {
    const name = player.name
    if (!name) continue
    const playerPredictions = predictions.get(name) ?? new Map()
    const favorite = favoriteByPlayer.get(name)
    const bonus = bonusByPlayer.get(name) ?? 0
    const byScope: Record<string, Row> = {}

    for (const [scope, matchIds] of Object.entries(scopes)) {
      let matchPts = 0
      let exact = 0
      let counted = 0
      let predicted = 0
      let totalR = 0

      for (const matchId of matchIds) {
        const result = results.get(matchId)
        if (!result) continue
        totalR++
        const prediction = playerPredictions.get(matchId)
        if (prediction) predicted++
        if (!prediction) continue
        counted++

        const raw = calcPts(prediction, result)
        const match = matchMeta.get(matchId)
        const doubled = match ? isFavoriteMatch(favorite, match) : false
        matchPts += raw * (doubled ? 2 : 1)
        if (raw === 5) exact++
      }

      const scopeBonus = ['all', 'vb', 'ko'].includes(scope) ? bonus : 0
      byScope[scope] = {
        pts: matchPts + scopeBonus,
        matchPts,
        bonus: scopeBonus,
        exact,
        counted,
        predicted,
        totalR,
        ppg: counted > 0 ? (matchPts + scopeBonus) / counted : 0
      }
    }

    const byMatch: Record<string, Row> = {}
    for (const [matchId, match] of matchMeta) {
      const result = results.get(matchId)
      const prediction = playerPredictions.get(matchId)
      if (!result || !prediction) continue
      const raw = calcPts(prediction, result)
      const favorite = isFavoriteMatch(favoriteByPlayer.get(name), match)
      byMatch[String(matchId)] = { raw, fav: favorite, pts: raw * (favorite ? 2 : 1), exact: raw === 5 }
    }

    const all = byScope.all ?? blankScore()
    scoreRows.push(
      withDefined({
        player: name,
        community: community === 'hu' ? undefined : community,
        pts: all.pts,
        matchPts: all.matchPts,
        bonus: all.bonus,
        exact: all.exact,
        counted: all.counted,
        predicted: all.predicted,
        totalR: all.totalR,
        ppg: all.ppg,
        byScope,
        byMatch
      })
    )
  }

  return scoreRows
}

function buildScopeSets(matchMeta: Map<number, MatchMeta>) {
  const testInAll = Date.now() < Date.UTC(2026, 5, 11, 14, 0, 0)
  const scopes: Record<string, number[]> = { all: [], vb: [], test: [], group: [], ko: [] }
  for (const [id, match] of matchMeta) {
    if (match.stage === 'group') {
      scopes.all.push(id)
      scopes.vb.push(id)
      scopes.group.push(id)
    } else if (match.stage === 'ko') {
      scopes.all.push(id)
      scopes.vb.push(id)
      scopes.ko.push(id)
    } else {
      scopes.test.push(id)
      if (testInAll) scopes.all.push(id)
    }
  }
  return scopes
}

function rankCommunities(settings: Row, playerScores: Row[]) {
  const rows: Row[] = []
  const scopes = ['all', 'vb', 'test', 'group', 'ko']
  const huPlayers = settings.players ?? []
  const enPlayers = settings.enPlayers ?? []
  const huLeagues = ['Mindenki', ...((settings.leagues ?? []) as string[]).filter((league) => league !== 'Mindenki')]

  const byCommunityAndPlayer = new Map<string, Row>()
  for (const score of playerScores) byCommunityAndPlayer.set(`${communityOf(score)}:${score.player}`, score)

  for (const scope of scopes) {
    for (const league of huLeagues) {
      const players = league === 'Mindenki' ? huPlayers : huPlayers.filter((player: Row) => (player.leagues ?? []).includes(league))
      rows.push({ scopeLeague: `${scope}_${league}`, rows: rankRows(players, 'hu', scope, byCommunityAndPlayer), ts: Date.now() })
    }
  }

  if (enPlayers.length) {
    for (const scope of ['all', 'vb', 'group', 'ko']) {
      rows.push({ scopeLeague: `en_${scope}_Mindenki`, rows: rankRows(enPlayers, 'en', scope, byCommunityAndPlayer), ts: Date.now() })
    }
  }

  return rows
}

function rankRows(players: Row[], community: string, scope: string, scores: Map<string, Row>) {
  return players
    .map((player) => {
      const score = scores.get(`${community}:${player.name}`)
      return score?.byScope?.[scope] ? { name: player.name, ...score.byScope[scope] } : { name: player.name, ...blankScore() }
    })
    .sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.ppg - a.ppg)
}

function blankScore() {
  return { pts: 0, matchPts: 0, bonus: 0, exact: 0, counted: 0, predicted: 0, totalR: 0, ppg: 0 }
}

function isFavoriteMatch(favorite: Row | undefined, match: MatchMeta) {
  const team = activeFavorite(favorite, match.stage)
  return Boolean(team && (match.home === team || match.away === team))
}

function activeFavorite(favorite: Row | undefined, stage: MatchMeta['stage']) {
  if (!favorite) return null
  if (favorite.switched && favorite.pendingKO && stage === 'group') return favorite.team || null
  return favorite.switched ? favorite.newTeam || favorite.team || null : favorite.team || null
}

function calcPts(prediction: Row, result: Row) {
  const ph = Number(prediction.h)
  const pa = Number(prediction.a)
  const rh = Number(result.h)
  const ra = Number(result.a)
  if (ph === rh && pa === ra) return 5
  const predictionDiff = ph - pa
  const resultDiff = rh - ra
  const predictionOutcome = Math.sign(predictionDiff)
  const resultOutcome = Math.sign(resultDiff)
  if (predictionOutcome === 0 && resultOutcome === 0) return 3
  if (predictionOutcome !== resultOutcome) return 0
  if (predictionDiff === resultDiff) return 3
  if (ph === rh || pa === ra) return 2
  return 1
}

function first(rows: Row[] | undefined) {
  return rows?.[0]
}

function communityOf(row: Row) {
  return row.community ?? 'hu'
}

function groupRows(rows: Row[] | undefined, community: string, select: (row: Row) => [string, string | number, unknown]) {
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

function mapCommunityRows(rows: Row[] | undefined, community: string, select: (row: Row) => [string | number, unknown]) {
  return mapEncodedRows((rows ?? []).filter((row) => communityOf(row) === community), select)
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

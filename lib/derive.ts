import type { GameState } from './types'
import { encodeClientKey } from './keys'
import { MATCH_BY_ID, type Fixture } from './fixtures'

export type MatchStatus = 'finished' | 'live' | 'open' | 'locked'

const MATCH_WINDOW_MS = 2.5 * 60 * 60 * 1000

// Resolve the teams to DISPLAY for a fixture. KO slots carry placeholders ("A2.") in the
// static schedule; once the bracket is known, koTeams (from the LiveScore poll) holds the
// real teams — prefer those.
export function teamsOf(state: GameState | null, fixture: Fixture): { home: string; away: string } {
  if (fixture.stage === 'ko') {
    const ko = state?.koTeams?.[String(fixture.id)]
    if (ko?.home && ko?.away) return { home: ko.home, away: ko.away }
  }
  return { home: fixture.home, away: fixture.away }
}

export function myPrediction(state: GameState | null, player: string, matchId: number) {
  return state?.predictions?.[encodeClientKey(player)]?.[String(matchId)] ?? null
}

export function myWizard(state: GameState | null, player: string, matchId: number) {
  return state?.wizardPicks?.[encodeClientKey(player)]?.[String(matchId)] ?? null
}

export function resultFor(state: GameState | null, matchId: number) {
  return state?.results?.[String(matchId)] ?? null
}

export function kickoffMs(fixture: Fixture): number {
  const t = new Date(fixture.date).getTime()
  return Number.isFinite(t) ? t : Infinity
}

export function statusOf(state: GameState | null, fixture: Fixture, now = Date.now()): MatchStatus {
  if (resultFor(state, fixture.id)) return 'finished'
  const ko = kickoffMs(fixture)
  if (now >= ko && now < ko + MATCH_WINDOW_MS) return 'live'
  if (!fixture.noLock && now >= ko) return 'locked'
  return 'open'
}

export function countdown(fixture: Fixture, now = Date.now()): string {
  const ko = kickoffMs(fixture)
  const diff = ko - now
  if (diff <= 0) return fixture.noLock ? 'nyitva' : 'lezárva'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)} nap`
  if (h >= 1) return `${h}ó ${m}p`
  if (m <= 6) return `${m} perc!`
  return `${m} perc`
}

// Decimal odds for a match from apiCache, if present. Returns [home, draw, away] or null.
export function oddsFor(state: GameState | null, matchId: number): [number, number, number] | null {
  const cache = state?.apiCache?.odds?.data as Record<string, { h?: number; x?: number; a?: number }> | undefined
  const o = cache?.[String(matchId)]
  if (o && o.h && o.x && o.a) return [o.h, o.x, o.a]
  return null
}

// Live in-progress score for a match from the apiCache 'live' row, if present.
// Written by runLiveScorePoll from /matches/live.json (NOT the results table).
// Returns { h, a, elapsed, status } or null.
export function liveScoreFor(
  state: GameState | null,
  matchId: number
): { h: number; a: number; elapsed?: string; status?: string } | null {
  const cache = state?.apiCache?.live?.data as
    | Record<string, { h?: number; a?: number; elapsed?: string; status?: string }>
    | undefined
  const o = cache?.[String(matchId)]
  if (o && typeof o.h === 'number' && typeof o.a === 'number') {
    return { h: o.h, a: o.a, elapsed: o.elapsed, status: o.status }
  }
  return null
}

export function isFavoriteMatch(state: GameState | null, player: string, fixture: Fixture): boolean {
  const fav = state?.favorites?.[encodeClientKey(player)]
  if (!fav?.team) return false
  const team = fav.switched ? fav.newTeam || fav.team : fav.team
  return fixture.home === team || fixture.away === team
}

// Buckets the fixtures into feed sections for the player home screen. `open` = still
// tippable (before kickoff); `locked` = kicked off but unresolved; kept separate so the
// Tippjeim feed can lead with the genuinely-tippable matches instead of old locked ones.
export function bucketFixtures(state: GameState | null, fixtures: Fixture[], now = Date.now()) {
  const live: Fixture[] = []
  const open: Fixture[] = []
  const locked: Fixture[] = []
  const finished: Fixture[] = []
  for (const f of fixtures) {
    const s = statusOf(state, f, now)
    if (s === 'live') live.push(f)
    else if (s === 'finished') finished.push(f)
    else if (s === 'locked') locked.push(f)
    else open.push(f)
  }
  const byKo = (a: Fixture, b: Fixture) => kickoffMs(a) - kickoffMs(b)
  // Open list: upcoming kickoffs first (soonest), then always-open (test) past games.
  const openSort = (a: Fixture, b: Fixture) => {
    const af = kickoffMs(a) >= now
    const bf = kickoffMs(b) >= now
    if (af !== bf) return af ? -1 : 1
    return af ? kickoffMs(a) - kickoffMs(b) : kickoffMs(b) - kickoffMs(a)
  }
  return {
    live: live.sort(byKo),
    open: open.sort(openSort),
    locked: locked.sort(byKo).reverse(),
    finished: finished.sort(byKo).reverse()
  }
}

export { MATCH_BY_ID }

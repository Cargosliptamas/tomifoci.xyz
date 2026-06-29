export type Score = { h: number; a: number }
export type Pick1X2 = '1' | 'X' | '2'
export type MatchStage = 'group' | 'ko' | 'test'

export interface MatchMeta {
  stage: MatchStage
  h: string
  a: string
  kickoff: string
}

export interface PlayerEntry {
  name: string
  leagues: string[]
}

export interface Prediction {
  player: string
  matchId: number
  h: number
  a: number
  community: string
}

export interface Result {
  matchId: number
  h: number
  a: number
  pen_h?: number | null
  pen_a?: number | null
}

export interface Bonus {
  player: string
  pts: number
  reason: string
  community?: string
}

export interface Favorite {
  player: string
  team: string
  switched: boolean
  newTeam?: string | null
  pendingKO?: boolean
  community?: string
}

export interface KoTeam {
  matchId: number
  home: string
  away: string
  confirmed?: boolean
  auto?: boolean
}

// ── Scoring output ──────────────────────────────────────────────────────────

export interface ScopeStats {
  pts: number
  matchPts: number
  bonus: number
  exact: number
  counted: number
  predicted: number
  totalR: number
  ppg: number
}

export interface MatchBreakdown {
  raw: number
  fav: boolean
  pts: number
  exact: boolean
}

export interface PlayerScore {
  player: string
  community: string
  pts: number
  matchPts: number
  bonus: number
  exact: number
  counted: number
  predicted: number
  totalR: number
  ppg: number
  byScope: Record<string, ScopeStats>
  byMatch: Record<number, MatchBreakdown>
}

export interface RankingRow {
  name: string
  pts: number
  matchPts: number
  bonus: number
  exact: number
  counted: number
  predicted: number
  totalR: number
  ppg: number
}

export interface RankingEntry {
  scopeLeague: string
  rows: RankingRow[]
}

// ── Wizard output ───────────────────────────────────────────────────────────

export interface WizardPick {
  player: string
  matchId: number
  pick: Pick1X2
  oddsAtPick: number
  oddsSource?: string
  lockedAt?: number
}

export interface WizardProfile {
  player: string
  active: boolean
  mirror: boolean
}

export interface OddsSnapshot {
  [matchId: string]: { home: number; draw: number; away: number }
}

export interface WizardMatchResult {
  pick: Pick1X2
  oddsAtPick: number
  correct: boolean
  pts: number
  disqualified?: boolean
}

export interface WizardScore {
  player: string
  pts: number
  played: number
  correct: number
  byMatch: Record<number, WizardMatchResult>
}

export interface WizardRankingRow {
  name: string
  pts: number
  played: number
  correct: number
  accuracy: number
}

// ── Swiss output ─────────────────────────────────────────────────────────────

export interface SwissProfile {
  player: string
  active: boolean
  joinedRound?: number
  removedAtRound?: number | null
}

export interface SwissPairing {
  round: number
  a: string
  b?: string | null
  tier?: number
  slot?: string
}

export type MatchupResult = 'a' | 'b' | 'draw' | 'bye' | 'void' | 'removed' | null

export interface Matchup {
  a: string
  b: string | null
  aPts: number
  bPts: number
  res: MatchupResult
  tier?: number
  slot?: string
}

export interface StandingRow {
  name: string
  place: number
  played: number
  w: number
  d: number
  l: number
  byes: number
  mp: number
  base: number
  bh: number
  active: boolean
  removed: boolean
  flagged: boolean
}

export interface SwissRoundResult {
  complete: boolean
  matchups: Matchup[]
}

export interface SwissOutput {
  standings: StandingRow[]
  rounds: Record<number, SwissRoundResult>
  completed: number[]
  flagged: string[]
}

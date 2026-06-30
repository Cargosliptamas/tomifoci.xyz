// Shape of the `game:state` payload returned by GET /api/state (secrets stripped).

export type ScoreEntry = {
  pts: number
  matchPts: number
  bonus: number
  exact: number
  counted: number
  predicted: number
  totalR: number
  ppg: number
  byScope?: Record<string, ScopeScore>
  byMatch?: Record<string, { raw: number; fav: boolean; pts: number; exact: boolean }>
}

export type ScopeScore = {
  pts: number
  matchPts: number
  bonus: number
  exact: number
  counted: number
  predicted: number
  totalR: number
  ppg: number
}

export type RankingRow = {
  name: string
  pts: number
  matchPts?: number
  bonus?: number
  exact: number
  counted?: number
  predicted?: number
  totalR?: number
  ppg: number
}

export type WizardRankRow = { name: string; place?: number; pts: number; accuracy?: number; played?: number }

export type SwissStanding = {
  name: string
  mp?: number
  w?: number
  d?: number
  l?: number
  place?: number
  predPts?: number
  buchholz?: number
}

export type PlayerInfo = { name: string; leagues?: string[] }

export type GameState = {
  settings: {
    players: PlayerInfo[]
    leagues: string[]
    privateLeagues?: unknown[]
    landingSkin?: string
    newsBoard?: unknown[]
    hasLsKey?: boolean
  }
  predictions: Record<string, Record<string, { h: number; a: number }>>
  results: Record<string, { h: number; a: number; pen_h?: number; pen_a?: number }>
  koTeams: Record<string, { home?: string; away?: string; confirmed?: boolean; auto?: boolean }>
  bonuses: Record<string, Array<{ pts: number; reason: string }>>
  favorites: Record<string, { team: string; switched?: boolean; newTeam?: string | null; pendingKO?: boolean }>
  apiCache: Record<string, { ts: number; data: unknown }>
  scores: Record<string, ScoreEntry>
  rankings: Record<string, RankingRow[]>
  wizardPicks: Record<string, Record<string, { pick: '1' | 'X' | '2'; oddsAtPick?: number | null }>>
  wizardProfiles: Record<string, { active?: boolean; mirror?: boolean }>
  wizardRankings: WizardRankRow[]
  swissProfiles: Array<{ player: string; active?: boolean; joinedRound?: number; removedAtRound?: number | null }>
  swissPairings: Array<{ round: number; a: string; b: string; tier?: string; slot?: number }>
  swiss: { standings?: SwissStanding[]; round?: number; frozen?: boolean } | null
  swissLog: Array<{ ts: number; who?: string; action?: string }>
  matchEvents?: Record<string, Array<{ minute: string; type: string; player: string; sub?: string; team: 'h' | 'a' }>>
  matchScores?: Record<string, { ht?: { h: number; a: number } }>
}

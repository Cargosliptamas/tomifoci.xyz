import type {
  OddsSnapshot,
  Pick1X2,
  Result,
  WizardPick,
  WizardProfile,
  WizardRankingRow,
  WizardScore,
} from './types'

// WIZ-04: odds clamped to [1.10, 10.00]
const ODDS_MIN = 1.1
const ODDS_MAX = 10.0

function clampOdds(raw: number): number {
  return Math.min(ODDS_MAX, Math.max(ODDS_MIN, raw))
}

// WIZ-08: derive 1X2 from a score prediction
export function pickFromScore(h: number, a: number): Pick1X2 {
  if (h > a) return '1'
  if (a > h) return '2'
  return 'X'
}

// WIZ-07: test matches (id ≥ 999) are excluded from Wizard
function isTestMatch(matchId: number): boolean {
  return matchId >= 999
}

function tripleFor(entry: { home: number; draw: number; away: number } | undefined, pick: Pick1X2): number {
  if (!entry) return 0
  return pick === '1' ? entry.home : pick === 'X' ? entry.draw : entry.away
}

// ── repairOdds ───────────────────────────────────────────────────────────────
// WIZ-13: repair 0-odds picks in order: snapshot → odds cache → peer most-recent → floor (if result exists)
// Returns new picks array with repaired oddsAtPick + oddsSource.
export function repairOdds(
  picks: WizardPick[],
  results: Result[],
  kickoffSnapshot: OddsSnapshot,
  oddsCache: OddsSnapshot,
): WizardPick[] {
  const resultMatchIds = new Set(results.map(r => r.matchId))

  // Build peer map: matchId+pick → { odds, lockedAt }
  const peerMap = new Map<string, { odds: number; ts: number }>()
  for (const p of picks) {
    if (p.oddsAtPick <= 0) continue
    const k = `${p.matchId}|${p.pick}`
    const cur = peerMap.get(k)
    if (!cur || (p.lockedAt ?? 0) > cur.ts) {
      peerMap.set(k, { odds: p.oddsAtPick, ts: p.lockedAt ?? 0 })
    }
  }

  return picks.map(p => {
    if (p.oddsAtPick > 0 || isTestMatch(p.matchId)) return p

    let odds = 0, src = ''

    const snap = kickoffSnapshot[String(p.matchId)]
    const rawSnap = tripleFor(snap, p.pick)
    if (rawSnap && isFinite(rawSnap)) { odds = clampOdds(rawSnap); src = 'snapshot' }

    if (!odds) {
      const live = oddsCache[String(p.matchId)]
      const rawLive = tripleFor(live, p.pick)
      if (rawLive && isFinite(rawLive)) { odds = clampOdds(rawLive); src = 'odds' }
    }

    if (!odds) {
      const peer = peerMap.get(`${p.matchId}|${p.pick}`)
      if (peer) { odds = clampOdds(peer.odds); src = 'peer' }
    }

    // WIZ-13: floor applied only once a result exists
    if (!odds && resultMatchIds.has(p.matchId)) { odds = ODDS_MIN; src = 'floor' }

    if (!odds) return p
    return { ...p, oddsAtPick: odds, oddsSource: src }
  })
}

// ── computeWizardScores ──────────────────────────────────────────────────────
// Pure function. Accepts pre-repaired picks (run repairOdds first).
export function computeWizardScores(
  picks: WizardPick[],
  results: Result[],
  profiles: WizardProfile[],
): WizardScore[] {
  const resultsMap = new Map(results.map(r => [r.matchId, { h: r.h, a: r.a }]))

  const profileMap = new Map(profiles.map(p => [p.player, p]))

  // All players that need a score: everyone with picks + active profiles
  const allPlayers = new Set([
    ...picks.map(p => p.player),
    ...profiles.filter(p => p.active).map(p => p.player),
  ])

  const picksByPlayer = new Map<string, WizardPick[]>()
  for (const p of picks) {
    if (!picksByPlayer.has(p.player)) picksByPlayer.set(p.player, [])
    picksByPlayer.get(p.player)!.push(p)
  }

  const scores: WizardScore[] = []
  for (const player of allPlayers) {
    const profile = profileMap.get(player)
    if (profile && !profile.active) continue // opted out

    const playerPicks = picksByPlayer.get(player) ?? []
    let pts = 0, played = 0, correct = 0
    const byMatch: Record<number, WizardScore['byMatch'][number]> = {}

    for (const pick of playerPicks) {
      if (isTestMatch(pick.matchId)) continue  // WIZ-07
      const res = resultsMap.get(pick.matchId)
      if (!res) continue

      if (pick.oddsAtPick === 0) {
        byMatch[pick.matchId] = { pick: pick.pick, oddsAtPick: 0, correct: false, pts: 0, disqualified: true }
        continue
      }

      played++
      const actual = pickFromScore(res.h, res.a)
      const isCorrect = pick.pick === actual  // WIZ-03: 90-min result only
      const matchPts = isCorrect ? Math.round(pick.oddsAtPick * 100) / 100 : 0
      pts += matchPts
      if (isCorrect) correct++
      byMatch[pick.matchId] = { pick: pick.pick, oddsAtPick: pick.oddsAtPick, correct: isCorrect, pts: matchPts }
    }

    scores.push({
      player,
      pts: Math.round(pts * 100) / 100,
      played,
      correct,
      byMatch,
    })
  }
  return scores
}

// ── computeWizardRankings ────────────────────────────────────────────────────
// WIZ-12: sorted by pts desc; accuracy = correct/played * 100 rounded
export function computeWizardRankings(
  scores: WizardScore[],
  profiles: WizardProfile[],
): WizardRankingRow[] {
  const profileMap = new Map(profiles.map(p => [p.player, p]))

  return scores
    .filter(s => {
      const pr = profileMap.get(s.player)
      return !pr || pr.active
    })
    .map(s => ({
      name: s.player,
      pts: s.pts,
      played: s.played,
      correct: s.correct,
      accuracy: s.played > 0 ? Math.round((s.correct / s.played) * 100) : 0,
    }))
    .sort((a, b) => b.pts - a.pts || b.correct - a.correct || b.played - a.played)
}

import { calcPts } from './scoring'
import { SWISS_ROUNDS } from './match-meta'
import type {
  Matchup,
  MatchupResult,
  Prediction,
  Result,
  StandingRow,
  SwissOutput,
  SwissPairing,
  SwissProfile,
  SwissRoundResult
} from './types'

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildPredMap(predictions: Prediction[]): Map<string, Map<number, { h: number; a: number }>> {
  const map = new Map<string, Map<number, { h: number; a: number }>>()
  for (const p of predictions) {
    if (!map.has(p.player)) map.set(p.player, new Map())
    map.get(p.player)!.set(p.matchId, { h: p.h, a: p.a })
  }
  return map
}

// Sum of base calcPts for all 8 matches in a round (SWISS-05: no fav ×2, no bonus)
function basePtsFor(
  player: string,
  round: number,
  preds: Map<string, Map<number, { h: number; a: number }>>,
  results: Map<number, { h: number; a: number }>
): number {
  const pp = preds.get(player)
  if (!pp) return 0
  let pts = 0
  for (const id of SWISS_ROUNDS[round - 1]) {
    const res = results.get(id)
    const pred = pp.get(id)
    if (res && pred) pts += calcPts(pred, res)
  }
  return pts
}

function predictedCount(
  player: string,
  round: number,
  preds: Map<string, Map<number, { h: number; a: number }>>
): number {
  const pp = preds.get(player)
  if (!pp) return 0
  return SWISS_ROUNDS[round - 1].filter((id) => pp.has(id)).length
}

function roundComplete(round: number, results: Map<number, unknown>): boolean {
  return SWISS_ROUNDS[round - 1].every((id) => results.has(id))
}

// ── computeSwiss ─────────────────────────────────────────────────────────────
// Pure function: accepts pre-loaded data, returns full Swiss output.
// SWISS-16: only swissProfiles + swissPairings are authoritative inputs.
// Everything else (matchup scores, match points, standings) is derived here.
export function computeSwiss(
  profilesInput: SwissProfile[],
  pairings: SwissPairing[],
  predictions: Prediction[],
  results: Result[]
): SwissOutput {
  const profiles = profilesInput.filter((p) => p.active !== false)
  const predMap = buildPredMap(predictions)
  const resultMap = new Map(results.map((r) => [r.matchId, { h: r.h, a: r.a }]))
  const profByName = new Map(profiles.map((p) => [p.player, p]))

  // Has removal effect in a given round: either actively removed by that round,
  // or predicted 0 in that completed round (treated as no-show for matchup scoring)
  function hasRemovalEffect(name: string, round: number): boolean {
    const p = profByName.get(name)
    if (p?.removedAtRound != null && round >= p.removedAtRound) return true
    if (p?.removedAtRound != null && predictedCount(name, round, predMap) === 0) return true
    return false
  }

  // Accumulators
  const mp: Record<string, number> = {}
  const w: Record<string, number> = {}
  const d: Record<string, number> = {}
  const l: Record<string, number> = {}
  const byes: Record<string, number> = {}
  const played: Record<string, number> = {}
  const oppsOf: Record<string, string[]> = {}
  const h2h: Record<string, 'a' | 'b' | 'draw'> = {}

  for (const p of profiles) {
    mp[p.player] = 0
    w[p.player] = 0
    d[p.player] = 0
    l[p.player] = 0
    byes[p.player] = 0
    played[p.player] = 0
    oppsOf[p.player] = []
  }

  const byRound: Record<number, SwissPairing[]> = {}
  for (const pr of pairings) (byRound[pr.round] ??= []).push(pr)

  const roundResults: Record<number, SwissRoundResult> = {}
  const completed: number[] = []

  for (let r = 1; r <= 13; r++) {
    const prs = byRound[r] ?? []
    if (!prs.length) continue

    const complete = roundComplete(r, resultMap)
    if (complete) completed.push(r)

    const matchups: Matchup[] = []
    for (const pr of prs) {
      const a = pr.a
      const b = pr.b ?? null
      const aPts = basePtsFor(a, r, predMap, resultMap)
      const bPts = b ? basePtsFor(b, r, predMap, resultMap) : 0
      const out: Matchup = {
        a,
        b,
        aPts,
        bPts,
        res: null,
        ...(pr.tier != null ? { tier: pr.tier } : {}),
        ...(pr.slot ? { slot: pr.slot } : {})
      }

      if (b && hasRemovalEffect(b, r) && !hasRemovalEffect(a, r)) {
        out.res = 'removed'
        mp[a] += 3
        byes[a]++
      } else if (b && hasRemovalEffect(a, r) && !hasRemovalEffect(b, r)) {
        out.res = 'removed'
        mp[b] += 3
        byes[b]++
      } else if (!b) {
        // SWISS-07: bye = 3 match pts, but only when the round is complete (SWISS-06)
        if (complete) {
          out.res = 'bye'
          mp[a] += 3
          byes[a]++
        }
      } else if (complete) {
        const aNo = predictedCount(a, r, predMap) === 0
        const bNo = predictedCount(b, r, predMap) === 0
        if (aNo && bNo) {
          // SWISS-08: both sides no predictions → 0-0 void (no draw point)
          out.res = 'void'
        } else if (aPts > bPts) {
          // SWISS-06: win = 3
          out.res = 'a'
          mp[a] += 3
          w[a]++
          l[b]++
        } else if (bPts > aPts) {
          out.res = 'b'
          mp[b] += 3
          w[b]++
          l[a]++
        } else {
          // SWISS-06: draw = 1–1
          out.res = 'draw'
          mp[a]++
          mp[b]++
          d[a]++
          d[b]++
        }

        if (out.res !== 'void') {
          played[a]++
          played[b]++
          oppsOf[a].push(b)
          oppsOf[b].push(a)
          const key = a < b ? `${a}||${b}` : `${b}||${a}`
          const raw: MatchupResult = out.res
          h2h[key] = a < b ? (raw as 'a' | 'b' | 'draw') : raw === 'a' ? 'b' : raw === 'b' ? 'a' : 'draw'
        }
      }

      matchups.push(out)
    }
    roundResults[r] = { complete, matchups }
  }

  // SWISS-10 tiebreak #2: base pts over COMPLETED league rounds (R1–10)
  const leagueCompleted = completed.filter((r) => r <= 10)
  const base: Record<string, number> = {}
  for (const p of profiles) {
    base[p.player] = 0
    for (const r of leagueCompleted) base[p.player] += basePtsFor(p.player, r, predMap, resultMap)
  }

  // SWISS-10 tiebreak #4: Buchholz = average opponents' match pts (byes excluded)
  const bh: Record<string, number> = {}
  for (const p of profiles) {
    const opps = oppsOf[p.player]
    bh[p.player] = opps.length
      ? Math.round((opps.reduce((s, o) => s + (mp[o] ?? 0), 0) / opps.length) * 100) / 100
      : 0
  }

  // SWISS-09: flag players with 2+ consecutive no-show completed rounds
  const flagged: string[] = []
  for (const p of profiles) {
    if (!p.active || p.removedAtRound != null) continue
    let streak = 0,
      hit = false
    for (const r of completed) {
      const inRound = (roundResults[r]?.matchups ?? []).some((m) => m.a === p.player || m.b === p.player)
      if (!inRound) continue
      if (predictedCount(p.player, r, predMap) === 0) {
        streak++
        if (streak >= 2) hit = true
      } else streak = 0
    }
    if (hit) flagged.push(p.player)
  }

  // Build standings rows
  let rows: StandingRow[] = profiles.map((p) => ({
    name: p.player,
    place: 0,
    played: played[p.player],
    w: w[p.player],
    d: d[p.player],
    l: l[p.player],
    byes: byes[p.player],
    mp: mp[p.player],
    base: base[p.player],
    bh: bh[p.player],
    active: p.active,
    removed: p.removedAtRound != null,
    flagged: flagged.includes(p.player)
  }))

  // SWISS-10: sort mp → base → name (stable id). H2H pass applied after.
  rows.sort((x, y) => y.mp - x.mp || y.base - x.base || x.name.localeCompare(y.name, 'hu'))

  // H2H pass: within pairs tied on (mp, base), if exactly 2 and decisive H2H result → swap
  for (let i = 0; i < rows.length - 1; i++) {
    const x = rows[i],
      y = rows[i + 1]
    const third = rows[i + 2]
    const tiedXY = x.mp === y.mp && x.base === y.base
    const tiedXYZ = third && tiedXY && third.mp === x.mp && third.base === x.base
    const prevTied = i > 0 && rows[i - 1].mp === x.mp && rows[i - 1].base === x.base
    if (tiedXY && !tiedXYZ && !prevTied) {
      const key = x.name < y.name ? `${x.name}||${y.name}` : `${y.name}||${x.name}`
      const hr = h2h[key]
      if (hr && hr !== 'draw') {
        const winner = x.name < y.name ? (hr === 'a' ? x.name : y.name) : hr === 'a' ? y.name : x.name
        if (rows[i].name !== winner) {
          rows[i] = y
          rows[i + 1] = x
        }
      }
    }
  }

  rows.forEach((r, i) => {
    r.place = i + 1
  })

  return { standings: rows, rounds: roundResults, completed, flagged }
}

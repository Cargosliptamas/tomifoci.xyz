import type { GameState } from './types'
import { GROUPS, MATCHES, type Fixture } from './fixtures'

export type GroupRow = { team: string; pts: number; gd: number; played: number; pos: number; group: string }

// Compute group-stage standings live from results: W=3, D=1, L=0; sort pts -> gd -> goals.
function teamPoints(results: GameState['results'], groupMatches: Fixture[]) {
  const acc: Record<string, { pts: number; gf: number; ga: number; played: number }> = {}
  const touch = (t: string) => (acc[t] ??= { pts: 0, gf: 0, ga: 0, played: 0 })

  for (const m of groupMatches) {
    const r = results[String(m.id)]
    if (!r) continue
    const home = touch(m.home)
    const away = touch(m.away)
    home.played++
    away.played++
    home.gf += r.h
    home.ga += r.a
    away.gf += r.a
    away.ga += r.h
    if (r.h > r.a) home.pts += 3
    else if (r.h < r.a) away.pts += 3
    else {
      home.pts += 1
      away.pts += 1
    }
  }
  return acc
}

export function groupTables(state: GameState | null): Array<{ group: string; rows: GroupRow[] }> {
  const results = state?.results ?? {}
  const groupMatches = MATCHES.filter((m) => m.stage === 'group')

  return Object.entries(GROUPS).map(([group, teams]) => {
    const acc = teamPoints(results, groupMatches.filter((m) => m.group === group))
    const rows: GroupRow[] = teams
      .map((team) => {
        const s = acc[team] ?? { pts: 0, gf: 0, ga: 0, played: 0 }
        return { team, pts: s.pts, gd: s.gf - s.ga, played: s.played, pos: 0, group }
      })
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd)
      .map((r, i) => ({ ...r, pos: i + 1 }))
    return { group, rows }
  })
}

// Best 8 third-placed teams across all groups (FIFA-style: pts -> gd).
export function bestThirds(tables: Array<{ group: string; rows: GroupRow[] }>): GroupRow[] {
  return tables
    .map((t) => t.rows[2])
    .filter(Boolean)
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd)
}

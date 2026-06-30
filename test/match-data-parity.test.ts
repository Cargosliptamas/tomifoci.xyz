import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { MATCH_META } from '../lib/engine/match-meta'

// C2 drift-guard: MATCH_META (the engine's scoring source) must stay in lockstep with the
// classic data.js MATCHES (used by the classic UI + livescore mapping). If they diverge,
// the lock, the display, and the scoring can silently disagree. This test fails loudly on
// any id/stage/team-name drift between the two.

type DjMatch = { id: number; stage: string; home: string; away: string }

function loadDataJsMatches(): DjMatch[] {
  const candidates = [
    join(process.cwd(), 'public', 'classic', 'data.js'),
    join(process.cwd(), 'apps', 'rewrite', 'public', 'classic', 'data.js'),
    join(process.cwd(), 'data.js')
  ]
  for (const c of candidates) {
    if (!existsSync(c)) continue
    const ctx: Record<string, unknown> = {}
    runInNewContext(
      `${readFileSync(c, 'utf8')}\n;globalThis.__M__ = MATCHES.map(({ id, stage, home, away }) => ({ id, stage, home, away }));`,
      ctx,
      { timeout: 1000 }
    )
    return (ctx.__M__ as DjMatch[]) ?? []
  }
  throw new Error('classic data.js not found in any candidate path')
}

// Invariant: MATCH_META (engine) is the source of truth; classic data.js must be a
// CONSISTENT SUBSET of it. MATCH_META may carry extra test fixtures that data.js omits,
// but every match data.js does define must agree on stage and (for group/test) team names.
describe('C2: classic data.js ⊆ MATCH_META (scoring source)', () => {
  const dj = loadDataJsMatches()

  it('every data.js match exists in MATCH_META with the same stage', () => {
    for (const m of dj) {
      const meta = MATCH_META[Number(m.id)]
      expect(meta, `id ${m.id} present in data.js but missing from MATCH_META`).toBeDefined()
      expect(meta.stage, `stage mismatch for id ${m.id}`).toBe(m.stage)
    }
  })

  it('group + test team names agree (these drive favourite ×2 and scope sets)', () => {
    for (const m of dj) {
      if (m.stage === 'ko') continue // KO names come from koTeams at runtime, not static data
      const meta = MATCH_META[Number(m.id)]
      expect(m.home, `home name drift for id ${m.id}`).toBe(meta.h)
      expect(m.away, `away name drift for id ${m.id}`).toBe(meta.a)
    }
  })

  it('all 72 group + 32 KO ids are identical across both sources', () => {
    const djWc = dj.filter((m) => m.stage !== 'test').map((m) => Number(m.id)).sort((a, b) => a - b)
    const metaWc = Object.entries(MATCH_META)
      .filter(([, meta]) => meta.stage !== 'test')
      .map(([id]) => Number(id))
      .sort((a, b) => a - b)
    expect(djWc).toEqual(metaWc)
  })
})

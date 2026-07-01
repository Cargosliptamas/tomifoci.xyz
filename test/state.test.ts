import { describe, it, expect } from 'vitest'
import { buildPublicState, encodeClientKey } from '../lib/client-state'
import { SWISS_ROUNDS } from '../lib/engine/match-meta'

// INV-09: secrets must never appear in the public game:state payload.
describe('buildPublicState — secret stripping (INV-09)', () => {
  const tables = {
    settings: [
      {
        leagues: ['Mindenki'],
        players: [{ name: 'Tomi', leagues: ['Mindenki'] }],
        enPlayers: [{ name: 'Tom' }],
        ls2Key: 'SECRET_KEY',
        ls2Secret: 'SECRET_SECRET',
        adminTotp: 'SECRET_TOTP',
        landingSkin: 'matchday',
        newsBoard: []
      }
    ],
    predictions: [],
    results: []
  }

  it('omits ls2Key / ls2Secret / adminTotp / enPlayers', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    const blob = JSON.stringify(state)
    expect(blob).not.toContain('SECRET_KEY')
    expect(blob).not.toContain('SECRET_SECRET')
    expect(blob).not.toContain('SECRET_TOTP')
    expect(state.settings).not.toHaveProperty('ls2Key')
    expect(state.settings).not.toHaveProperty('ls2Secret')
    expect(state.settings).not.toHaveProperty('adminTotp')
    expect(state.settings).not.toHaveProperty('enPlayers')
  })

  it('exposes a hasLsKey boolean instead of the raw key', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    expect(state.settings).toHaveProperty('hasLsKey', true)
  })

  it('returns the expected top-level shape', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    for (const key of [
      'settings',
      'predictions',
      'results',
      'favorites',
      'scores',
      'rankings',
      'wizardPicks'
    ]) {
      expect(state).toHaveProperty(key)
    }
  })
})

// C1 unified path: score + ranking now flow through the pure engine (computeAllScores +
// computeRankings against MATCH_META). This exercises favourite ×2, exact detection,
// ranking order, and the removal of the standalone 'test' leaderboard.
describe('buildPublicState — score + ranking via the engine (C1)', () => {
  const tables = {
    settings: [
      {
        leagues: ['Mindenki'],
        players: [
          { name: 'Anna', leagues: ['Mindenki'] },
          { name: 'Bela', leagues: ['Mindenki'] }
        ]
      }
    ],
    predictions: [
      { player: 'Anna', matchId: 1, h: 2, a: 0, community: 'hu' }, // exact (match 1: Mexikó–Dél-Afrika)
      { player: 'Anna', matchId: 3, h: 1, a: 1, community: 'hu' }, // exact (match 3: Kanada–Bosznia)
      { player: 'Bela', matchId: 1, h: 0, a: 0, community: 'hu' } // wrong outcome → 0
    ],
    results: [
      { matchId: 1, h: 2, a: 0 },
      { matchId: 3, h: 1, a: 1 }
    ],
    favorites: [
      { player: 'Anna', team: 'Mexikó', switched: false, community: 'hu' } // match 1 home → ×2
    ]
  }

  it('doubles favourite match points and ranks players by points', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    const board = state.rankings[encodeClientKey('all_Mindenki')] as Array<{
      name: string
      pts: number
      exact: number
      counted: number
    }>
    expect(board).toBeDefined()
    // Anna: match1 exact(5) ×2 fav = 10, match3 exact(5) = 15 total, 2 exacts.
    expect(board[0]).toMatchObject({ name: 'Anna', pts: 15, exact: 2, counted: 2 })
    // Bela: predicted 0-0 vs 2-0 → wrong outcome → 0 pts, 1 counted.
    expect(board[1]).toMatchObject({ name: 'Bela', pts: 0, counted: 1 })
  })

  it('emits no standalone test leaderboard (4 hu scopes × 1 league)', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    // hu scopes are all/vb/group/ko (no 'test') × the single 'Mindenki' league.
    expect(Object.keys(state.rankings).length).toBe(4)
  })
})

describe('buildPublicState — match centre events from apiCache', () => {
  it('exposes cached goals/cards/subs and half-time score as public presentation state only', () => {
    const tables = {
      settings: [{ leagues: ['Mindenki'], players: [{ name: 'Anna' }] }],
      predictions: [],
      results: [{ matchId: 1, h: 2, a: 1 }],
      apiCache: [
        {
          kind: 'events_1',
          ts: 123,
          data: {
            events: [
              { minute: '12', type: 'goal', player: 'Scorer', team: 'h' },
              { minute: '58', type: 'yellow', player: 'Booked', team: 'a' },
              { minute: '70', type: 'sub', player: 'In', sub: 'Out', team: 'h' }
            ],
            htScore: { h: 1, a: 0 }
          }
        }
      ]
    }

    const state = buildPublicState(tables, { community: 'hu' })
    expect(state.matchEvents?.['1']).toEqual(tables.apiCache[0].data.events)
    expect(state.matchScores?.['1']).toEqual({ ht: { h: 1, a: 0 } })
    // Scoring still comes only from result truth; events do not add points.
    expect((state.scores[encodeClientKey('Anna')] as { pts: number }).pts).toBe(0)
  })

  it('exposes legacy array-shaped cached events after normalization', () => {
    const tables = {
      settings: [{ leagues: ['Mindenki'], players: [{ name: 'Anna' }] }],
      predictions: [],
      results: [{ matchId: 1, h: 2, a: 1 }],
      apiCache: [
        {
          kind: 'events_1',
          ts: 123,
          data: [{ icon: '⚽', side: 'away', time: '12', player: 'Scorer' }]
        }
      ]
    }

    const state = buildPublicState(tables, { community: 'hu' })
    expect(state.matchEvents?.['1']).toEqual([{ minute: '12', type: 'goal', player: 'Scorer', team: 'a' }])
  })
})

// Wizard of ODDS must SCORE LIVE from the engine, not from a frozen snapshot.
describe('buildPublicState — live Wizard of ODDS ranking', () => {
  const tables = {
    settings: [{ leagues: ['Mindenki'], players: [{ name: 'Anna' }, { name: 'Béla' }, { name: 'Cili' }] }],
    predictions: [
      // mirror-derived picks for explicitly joined players
      { player: 'Anna', matchId: 1, h: 2, a: 0, community: 'hu' }, // pick '1'
      { player: 'Anna', matchId: 3, h: 0, a: 0, community: 'hu' }, // pick 'X'
      { player: 'Béla', matchId: 1, h: 0, a: 1, community: 'hu' }, // pick '2'
      { player: 'Cili', matchId: 1, h: 1, a: 0, community: 'hu' } // pick '1'
    ],
    results: [
      { matchId: 1, h: 2, a: 0 }, // actual '1'
      { matchId: 3, h: 0, a: 0 } // actual 'X'
    ],
    wizardProfiles: [
      { player: 'Anna', active: true, mirror: true },
      { player: 'Béla', active: true, mirror: true },
      { player: 'Cili', active: true, mirror: true }
    ],
    // odds repair source for the mirror picks (oddsAtPick starts at 0)
    apiCache: [
      {
        kind: 'kickoffOdds',
        ts: 1,
        data: {
          '1': { home: 1.8, draw: 3.5, away: 4.2 },
          '3': { home: 2.0, draw: 3.0, away: 3.5 }
        }
      }
    ]
  }

  it('computes pts, accuracy and place from picks + results', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    const rows = state.wizardRankings
    expect(rows.length).toBe(3)

    // Anna: match1 '1' (1.80) + match3 'X' (3.00) = 4.80, both correct
    expect(rows[0]).toMatchObject({ name: 'Anna', place: 1, played: 2, accuracy: 100 })
    expect(rows[0].pts).toBeCloseTo(4.8, 5)
    // Cili: match1 '1' correct (1.80)
    expect(rows[1]).toMatchObject({ name: 'Cili', place: 2, played: 1, accuracy: 100 })
    expect(rows[1].pts).toBeCloseTo(1.8, 5)
    // Béla: match1 '2' wrong → 0 pts
    expect(rows[2]).toMatchObject({ name: 'Béla', place: 3, played: 1, accuracy: 0, pts: 0 })
  })

  it('requires an explicit active wizard profile for classic opt-in parity', () => {
    const state = buildPublicState(
      { ...tables, wizardProfiles: [{ player: 'Anna', active: true, mirror: true }] },
      { community: 'hu' }
    )
    expect(state.wizardRankings.map((r) => r.name)).toEqual(['Anna'])
  })
})

// Swiss / Párbaj standings must be derived live from pairings + predictions + results.
describe('buildPublicState — live Swiss / Párbaj standings', () => {
  const round1 = SWISS_ROUNDS[0]
  const tables = {
    settings: [{ leagues: ['Mindenki'], players: [{ name: 'Anna' }, { name: 'Béla' }, { name: 'Cili' }] }],
    predictions: [
      ...round1.map((matchId) => ({ player: 'Anna', matchId, h: 1, a: 0, community: 'hu' })), // 5 pts each
      ...round1.map((matchId) => ({ player: 'Béla', matchId, h: 0, a: 0, community: 'hu' })) // 0 pts each
    ],
    results: round1.map((matchId) => ({ matchId, h: 1, a: 0 })),
    swissProfiles: [
      { player: 'Anna', active: true },
      { player: 'Béla', active: true },
      { player: 'Cili', active: false }
    ],
    swissPairings: [{ round: 1, a: 'Anna', b: 'Béla' }]
  }

  it('derives match points, records, predicted points and Buchholz', () => {
    const state = buildPublicState(tables, { community: 'hu' })
    expect(state.swiss).not.toBeNull()
    const standings = state.swiss!.standings
    expect(standings.length).toBe(2)
    expect(standings.map((r) => r.name)).not.toContain('Cili')

    // Anna swept round 1 (8×5 = 40 base pts) → wins the matchup (3 mp)
    expect(standings[0]).toMatchObject({ name: 'Anna', place: 1, mp: 3, w: 1, d: 0, l: 0, predPts: 40 })
    expect(standings[0].buchholz).toBe(0) // sole opponent Béla has 0 mp
    // Béla predicted but lost the matchup
    expect(standings[1]).toMatchObject({ name: 'Béla', place: 2, mp: 0, w: 0, l: 1, predPts: 0 })
    expect(standings[1].buchholz).toBe(3) // sole opponent Anna has 3 mp

    // Round 1 fully resulted → current round advances to 2; not frozen (R10 unfinished)
    expect(state.swiss!.round).toBe(2)
    expect(state.swiss!.frozen).toBe(false)
  })
})

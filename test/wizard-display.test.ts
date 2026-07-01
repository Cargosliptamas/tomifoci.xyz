import { describe, expect, it } from 'vitest'
import { wizardGainFor } from '../lib/derive'
import { encodeClientKey } from '../lib/keys'
import type { GameState } from '../lib/types'

function stateFor(result?: { h: number; a: number }): GameState {
  return {
    settings: { players: [], leagues: [] },
    predictions: {},
    results: result ? { '71': result } : {},
    koTeams: {},
    bonuses: {},
    favorites: {},
    apiCache: {},
    scores: {},
    rankings: {},
    wizardPicks: {
      [encodeClientKey('Front Man')]: {
        '71': { pick: '2', oddsAtPick: 2.15 }
      }
    },
    wizardProfiles: {},
    wizardRankings: [],
    swissProfiles: [],
    swissPairings: [],
    swiss: null,
    swissLog: []
  }
}

describe('wizardGainFor', () => {
  it('shows zero settled gain for a wrong finished Wizard pick', () => {
    expect(wizardGainFor(stateFor({ h: 3, a: 3 }), 'Front Man', 71)).toBe(0)
  })

  it('keeps the odds value when the settled pick is correct', () => {
    expect(wizardGainFor(stateFor({ h: 1, a: 2 }), 'Front Man', 71)).toBe(2.15)
  })

  it('shows the at-stake odds before the match has a result', () => {
    expect(wizardGainFor(stateFor(), 'Front Man', 71)).toBe(2.15)
  })
})

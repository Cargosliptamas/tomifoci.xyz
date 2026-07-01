import { describe, expect, it } from 'vitest'
import { mergeMatchCentreCache } from '../app/api/match/[id]/route'

describe('mergeMatchCentreCache', () => {
  it('does not erase persisted events when a later feed fetch returns empty events', () => {
    const cached = {
      events: [{ minute: '12', type: 'goal', player: 'Scorer', team: 'h' }],
      lineups: { home: [{ num: '9', name: 'Nine' }], away: [] },
      odds: { h: 1.8, x: 3.4, a: 4.1 },
      status: 'FT',
      venue: 'Arena',
      htScore: { h: 1, a: 0 }
    }
    const fresh = { events: [], lineups: null, odds: null, status: '', venue: null, htScore: null }

    expect(mergeMatchCentreCache(cached, fresh)).toEqual(cached)
  })

  it('uses fresh events when the feed has a newer non-empty event list', () => {
    const cached = { events: [{ minute: '12', type: 'goal', player: 'Old', team: 'h' }], status: 'LIVE' }
    const fresh = { events: [{ minute: '55', type: 'red', player: 'New', team: 'a' }], status: 'LIVE' }

    expect(mergeMatchCentreCache(cached, fresh).events).toEqual(fresh.events)
  })
})

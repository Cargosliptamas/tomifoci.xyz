import { describe, expect, it } from 'vitest'
import { mergeMatchCentreCache } from '../app/api/match/[id]/route'
import { normalizeMatchEvents } from '../lib/match-events'

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

  it('normalizes legacy array-shaped cached events to the public shape', () => {
    const legacy = [
      { icon: '⚽', side: 'home', time: '12', player: 'Scorer' },
      { icon: '🔄', side: 'away', time: '64', player: 'In', sub: 'Out' },
      { icon: '⚽', side: 'away', time: '80', player: 'Own scorer ög' }
    ]

    expect(normalizeMatchEvents(legacy)).toEqual([
      { minute: '12', type: 'goal', player: 'Scorer', team: 'h' },
      { minute: '64', type: 'sub', player: 'In', sub: 'Out', team: 'a' },
      { minute: '80', type: 'own_goal', player: 'Own scorer ög', team: 'a' }
    ])
  })

  it('normalizes accidental numeric-key objects produced by array spreading', () => {
    const numericObject = {
      0: { icon: '⚽', side: 'home', time: '15', player: 'Penalty 11m' },
      1: { icon: '🟨🟥', side: 'away', time: '70', player: 'Sent off' },
      events: []
    }

    expect(normalizeMatchEvents(numericObject)).toEqual([
      { minute: '15', type: 'goal_penalty', player: 'Penalty 11m', team: 'h' },
      { minute: '70', type: 'yellow_red', player: 'Sent off', team: 'a' }
    ])
  })
})

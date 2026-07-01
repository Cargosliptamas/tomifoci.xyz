import { describe, expect, it } from 'vitest'
import { aggregateResultPushPayload, resultPushPayload } from '../lib/result-notifications'

describe('result push payloads', () => {
  it('builds a match-specific result notification', () => {
    expect(resultPushPayload({ matchId: 1, h: 2, a: 1 })).toMatchObject({
      title: '🇲🇽 Mexikó 2:1 Dél-Afrika 🇿🇦',
      tag: 'result-1',
      url: '/meccs-center?match=1'
    })
  })

  it('aggregates multiple result notifications into one push', () => {
    expect(
      aggregateResultPushPayload([
        { matchId: 1, h: 2, a: 1 },
        { matchId: 2, h: 0, a: 0 }
      ])
    ).toMatchObject({
      title: '2 új eredmény',
      tag: 'results-updated',
      url: '/meccs-center'
    })
  })
})

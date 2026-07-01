import { describe, expect, it } from 'vitest'
import { isFinalLiveStatus, matchResultScore } from '../lib/livescore'

describe('LiveScore result parsing', () => {
  it('parses nested history score shapes used by KO matches', () => {
    expect(matchResultScore({ scores: { score: '2-1' } })).toEqual({ h: 2, a: 1 })
    expect(matchResultScore({ scores: { ft_score: '0:0' } })).toEqual({ h: 0, a: 0 })
  })

  it('prefers explicit full-time score over generic score', () => {
    expect(matchResultScore({ ft_score: '1-1', scores: { score: '2-1' } })).toEqual({ h: 1, a: 1 })
  })

  it('recognizes final live statuses without treating in-play as final', () => {
    expect(isFinalLiveStatus('FINISHED')).toBe(true)
    expect(isFinalLiveStatus('FT')).toBe(true)
    expect(isFinalLiveStatus('IN PLAY')).toBe(false)
    expect(isFinalLiveStatus('90+')).toBe(false)
  })
})

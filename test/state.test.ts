import { describe, it, expect } from 'vitest'
import { buildPublicState } from '../lib/client-state'

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
    for (const key of ['settings', 'predictions', 'results', 'favorites', 'scores', 'rankings', 'wizardPicks']) {
      expect(state).toHaveProperty(key)
    }
  })
})

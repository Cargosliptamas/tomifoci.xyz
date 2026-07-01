import { describe, expect, it } from 'vitest'
import {
  addLeague,
  deleteLeague,
  normalizeLeagueList,
  renameLeague,
  setPlayerLeagues
} from '../lib/admin-leagues'

describe('admin league helpers', () => {
  const players = [
    { name: 'Anna', leagues: ['Baratok'] },
    { name: 'Bela', leagues: ['Baratok', 'Csalad'] },
    { name: 'Cili', leagues: [] }
  ]

  it('normalizes leagues with Mindenki first and duplicates removed', () => {
    expect(normalizeLeagueList(['Baratok', 'Mindenki', 'Baratok', '', 'Csalad'])).toEqual([
      'Mindenki',
      'Baratok',
      'Csalad'
    ])
  })

  it('adds a new non-global league', () => {
    expect(addLeague(['Mindenki', 'Baratok'], ' Csalad ')).toEqual({
      ok: true,
      league: 'Csalad',
      leagues: ['Mindenki', 'Baratok', 'Csalad']
    })
    expect(addLeague(['Mindenki'], 'Mindenki')).toEqual({ ok: false, error: 'bad-league' })
  })

  it('renames a league in both league list and player memberships', () => {
    const result = renameLeague(['Mindenki', 'Baratok', 'Csalad'], players, 'Baratok', 'Iroda')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.leagues).toEqual(['Mindenki', 'Iroda', 'Csalad'])
    expect(result.players).toEqual([
      { name: 'Anna', leagues: ['Iroda'] },
      { name: 'Bela', leagues: ['Iroda', 'Csalad'] },
      { name: 'Cili', leagues: [] }
    ])
  })

  it('deletes a league from list and memberships without deleting players', () => {
    const result = deleteLeague(['Mindenki', 'Baratok', 'Csalad'], players, 'Baratok')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.leagues).toEqual(['Mindenki', 'Csalad'])
    expect(result.players).toEqual([
      { name: 'Anna', leagues: [] },
      { name: 'Bela', leagues: ['Csalad'] },
      { name: 'Cili', leagues: [] }
    ])
  })

  it('sets a player membership only to existing non-global leagues', () => {
    const result = setPlayerLeagues(
      players,
      'Anna',
      ['Mindenki', 'Csalad', 'Missing', 'Csalad'],
      ['Mindenki', 'Baratok', 'Csalad']
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.leagues).toEqual(['Csalad'])
    expect(result.players[0]).toEqual({ name: 'Anna', leagues: ['Csalad'] })
  })
})

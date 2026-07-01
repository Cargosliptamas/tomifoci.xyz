export const GLOBAL_LEAGUE = 'Mindenki'

export type LeaguePlayer = {
  name: string
  leagues?: string[]
}

export function cleanLeagueName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60)
}

export function normalizeLeagueList(leagues: unknown): string[] {
  const out = [GLOBAL_LEAGUE]
  if (!Array.isArray(leagues)) return out
  for (const raw of leagues) {
    const name = cleanLeagueName(raw)
    if (!name || name === GLOBAL_LEAGUE || out.includes(name)) continue
    out.push(name)
  }
  return out
}

export function sanitizePlayerLeagues(leagues: unknown, availableLeagues: string[]): string[] {
  if (!Array.isArray(leagues)) return []
  const available = new Set(availableLeagues.filter((league) => league !== GLOBAL_LEAGUE))
  const out: string[] = []
  for (const raw of leagues) {
    const name = cleanLeagueName(raw)
    if (!name || !available.has(name) || out.includes(name)) continue
    out.push(name)
  }
  return out
}

export function addLeague(
  leagues: unknown,
  rawLeague: unknown
): { ok: true; leagues: string[]; league: string } | { ok: false; error: string } {
  const league = cleanLeagueName(rawLeague)
  if (!league || league === GLOBAL_LEAGUE) return { ok: false, error: 'bad-league' }

  const current = normalizeLeagueList(leagues)
  if (current.includes(league)) return { ok: false, error: 'league-exists' }
  return { ok: true, leagues: [...current, league], league }
}

export function renameLeague<T extends LeaguePlayer>(
  leagues: unknown,
  players: T[],
  rawOldLeague: unknown,
  rawNewLeague: unknown
):
  | { ok: true; leagues: string[]; players: T[]; oldLeague: string; newLeague: string }
  | { ok: false; error: string } {
  const oldLeague = cleanLeagueName(rawOldLeague)
  const newLeague = cleanLeagueName(rawNewLeague)
  if (!oldLeague || oldLeague === GLOBAL_LEAGUE || !newLeague || newLeague === GLOBAL_LEAGUE) {
    return { ok: false, error: 'bad-league' }
  }

  const current = normalizeLeagueList(leagues)
  if (!current.includes(oldLeague)) return { ok: false, error: 'league-not-found' }
  if (current.includes(newLeague)) return { ok: false, error: 'league-exists' }

  const nextLeagues = current.map((league) => (league === oldLeague ? newLeague : league))
  const nextPlayers = players.map((player) => ({
    ...player,
    leagues: sanitizePlayerLeagues(
      (player.leagues ?? []).map((league) => (league === oldLeague ? newLeague : league)),
      nextLeagues
    )
  }))
  return { ok: true, leagues: nextLeagues, players: nextPlayers, oldLeague, newLeague }
}

export function deleteLeague<T extends LeaguePlayer>(
  leagues: unknown,
  players: T[],
  rawLeague: unknown
): { ok: true; leagues: string[]; players: T[]; league: string } | { ok: false; error: string } {
  const league = cleanLeagueName(rawLeague)
  if (!league || league === GLOBAL_LEAGUE) return { ok: false, error: 'bad-league' }

  const current = normalizeLeagueList(leagues)
  if (!current.includes(league)) return { ok: false, error: 'league-not-found' }

  const nextLeagues = current.filter((entry) => entry !== league)
  const nextPlayers = players.map((player) => ({
    ...player,
    leagues: sanitizePlayerLeagues(player.leagues ?? [], nextLeagues)
  }))
  return { ok: true, leagues: nextLeagues, players: nextPlayers, league }
}

export function setPlayerLeagues<T extends LeaguePlayer>(
  players: T[],
  playerName: string,
  rawLeagues: unknown,
  availableLeagues: string[]
): { ok: true; players: T[]; leagues: string[] } | { ok: false; error: string } {
  if (!playerName) return { ok: false, error: 'bad-name' }
  if (!players.some((player) => player.name === playerName)) return { ok: false, error: 'player-not-found' }

  const nextMembership = sanitizePlayerLeagues(rawLeagues, availableLeagues)
  const nextPlayers = players.map((player) =>
    player.name === playerName ? { ...player, leagues: nextMembership } : player
  )
  return { ok: true, players: nextPlayers, leagues: nextMembership }
}

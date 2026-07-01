export type MatchEvent = { minute: string; type: string; player: string; sub?: string; team: 'h' | 'a' }
export type LineupPlayer = { num: string; name: string }
export type MatchCentre = {
  events: MatchEvent[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] } | null
  odds: { h: number; x: number; a: number } | null
  status: string
  venue: string | null
  htScore: { h: number; a: number } | null
}

const KNOWN_EVENT_TYPES = new Set([
  'goal',
  'goal_penalty',
  'own_goal',
  'yellow',
  'red',
  'yellow_red',
  'sub',
  'missed_penalty'
])

const FEED_EVENT_TYPES: Record<string, string> = {
  GOAL: 'goal',
  GOAL_PENALTY: 'goal_penalty',
  PENALTY: 'goal_penalty',
  OWN_GOAL: 'own_goal',
  YELLOW_CARD: 'yellow',
  RED_CARD: 'red',
  YELLOW_RED_CARD: 'yellow_red',
  SUBSTITUTION: 'sub',
  MISSED_PENALTY: 'missed_penalty'
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (isRecord(value)) return String(value.name ?? value.player_name ?? '')
  return String(value ?? '')
}

function eventEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  if (Array.isArray(value.events) && value.events.length > 0) return value.events
  const numericEntries = Object.entries(value)
    .filter(([key]) => /^\d+$/.test(key))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, event]) => event)
  return numericEntries.length > 0 ? numericEntries : Array.isArray(value.events) ? value.events : []
}

function eventType(raw: Record<string, any>): string | null {
  const explicit = String(raw.type ?? raw.event ?? '').trim()
  const lower = explicit.toLowerCase()
  if (KNOWN_EVENT_TYPES.has(lower)) return lower

  const feedType = FEED_EVENT_TYPES[explicit.toUpperCase()]
  if (feedType) return feedType

  const icon = String(raw.icon ?? '').trim()
  if (icon === '🔄') return 'sub'
  if (icon === '🟨🟥') return 'yellow_red'
  if (icon === '🟥') return 'red'
  if (icon === '🟨') return 'yellow'
  if (icon === '✗') return 'missed_penalty'
  if (icon === '⚽') {
    const note = [
      explicit,
      stringValue(raw.note),
      stringValue(raw.info),
      stringValue(raw.player),
      stringValue(raw.player_name)
    ]
      .join(' ')
      .toLowerCase()
    if (note.includes('11m') || note.includes('penalty')) return 'goal_penalty'
    if (note.includes('ög') || note.includes('own')) return 'own_goal'
    return 'goal'
  }

  return null
}

function eventTeam(raw: Record<string, any>): 'h' | 'a' {
  if (raw.team === 'h' || raw.team === 'a') return raw.team
  const side = String(raw.side ?? raw.home_away ?? '').toLowerCase()
  return side === 'a' || side.startsWith('away') || side.startsWith('vend') ? 'a' : 'h'
}

export function normalizeMatchEvents(value: unknown): MatchEvent[] {
  return eventEntries(value)
    .map((raw) => {
      if (!isRecord(raw)) return null
      const type = eventType(raw)
      if (!type) return null
      const player = stringValue(raw.player ?? raw.player_name).trim()
      const sub = stringValue(raw.sub ?? raw.player_2 ?? raw.substitute).trim()
      const event: MatchEvent = {
        minute: String(raw.minute ?? raw.time ?? ''),
        type,
        player,
        team: eventTeam(raw)
      }
      if (sub) event.sub = sub
      return event
    })
    .filter((event): event is MatchEvent => Boolean(event))
}

export function normalizeMatchCentre(value: unknown): MatchCentre {
  const data = isRecord(value) ? value : {}
  return {
    events: normalizeMatchEvents(value),
    lineups: data.lineups ?? null,
    odds: data.odds ?? null,
    status: data.status || '',
    venue: data.venue ?? null,
    htScore: data.htScore ?? null
  }
}

export function mergeMatchCentreCache(cached: unknown, fresh: unknown): MatchCentre {
  const cachedData = normalizeMatchCentre(cached)
  const freshData = normalizeMatchCentre(fresh)
  return {
    ...cachedData,
    ...freshData,
    events: freshData.events.length > 0 ? freshData.events : cachedData.events,
    lineups: freshData.lineups ?? cachedData.lineups ?? null,
    odds: freshData.odds ?? cachedData.odds ?? null,
    status: freshData.status || cachedData.status || '',
    venue: freshData.venue ?? cachedData.venue ?? null,
    htScore: freshData.htScore ?? cachedData.htScore ?? null
  }
}

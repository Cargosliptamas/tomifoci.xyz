// Client session: who is logged in, their language, and their PIN (kept only in this
// browser's localStorage so writes can be authenticated without re-prompting each time).

export type Session = { player: string; pin: string; community: 'hu' | 'en' }

const KEY = 'tomifoci_session'

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s && typeof s.player === 'string' && typeof s.pin === 'string') {
      return { player: s.player, pin: s.pin, community: s.community === 'en' ? 'en' : 'hu' }
    }
  } catch {
    // corrupt — ignore
  }
  return null
}

export function writeSession(session: Session) {
  window.localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession() {
  window.localStorage.removeItem(KEY)
}

'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { GameState } from '@/lib/types'
import { readSession, type Session } from '@/lib/session'

type Status = 'loading' | 'ready' | 'error' | 'offline'

type GameContextValue = {
  state: GameState | null
  status: Status
  error: string | null
  session: Session | null
  lastUpdated: number | null
  refresh: () => Promise<void>
  savePrediction: (matchId: number, h: number, a: number) => Promise<WriteResult>
  saveWizard: (matchId: number, pick: '1' | 'X' | '2', oddsAtPick?: number | null) => Promise<WriteResult>
  setFavorite: (team: string) => Promise<WriteResult>
}

export type WriteResult = { ok: boolean; error?: string }

const GameContext = createContext<GameContextValue | null>(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>')
  return ctx
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const sessionRef = useRef<Session | null>(null)

  if (sessionRef.current === null && typeof window !== 'undefined') {
    sessionRef.current = readSession()
  }
  const community = sessionRef.current?.community ?? 'hu'

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?community=${community}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setStatus('error')
        setError(json.error ?? `HTTP ${res.status}`)
        return
      }
      setState(json.state as GameState)
      setLastUpdated(Date.now())
      setStatus('ready')
      setError(null)
    } catch {
      setStatus('offline')
      setError('offline')
    }
  }, [community])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const write = useCallback(
    async (url: string, payload: Record<string, unknown>): Promise<WriteResult> => {
      const session = sessionRef.current
      if (!session) return { ok: false, error: 'no-session' }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, player: session.player, pin: session.pin, community: session.community })
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` }
        await refresh()
        return { ok: true }
      } catch {
        return { ok: false, error: 'offline' }
      }
    },
    [refresh]
  )

  const value: GameContextValue = {
    state,
    status,
    error,
    session: sessionRef.current,
    lastUpdated,
    refresh,
    savePrediction: (matchId, h, a) => write('/api/predictions', { matchId, h, a }),
    saveWizard: (matchId, pick, oddsAtPick) => write('/api/wizard', { matchId, pick, oddsAtPick }),
    setFavorite: (team) => write('/api/favorites', { team })
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

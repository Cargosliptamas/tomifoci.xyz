'use client'

import { useEffect, useState } from 'react'
import { useGame } from '@/components/game-provider'
import { flag } from '@/lib/fixtures'

type HistoryRow = {
  id: number
  home: string
  away: string
  result: { h: number; a: number; pen_h?: number | null; pen_a?: number | null }
  prediction: { h: number; a: number }
  wizardPick: '1' | 'X' | '2' | null
  earned: { raw: number; fav: boolean; pts: number; exact: boolean } | null
}

type HistoryResponse = {
  ok: boolean
  error?: string
  history?: {
    player: string
    summary: { pts: number; ppg: number; exact: number }
    rows: HistoryRow[]
    nextOffset: number | null
    total: number
  }
}

const PAGE_SIZE = 10

// Read-only player-history modal. Opened by clicking a player on any leaderboard.
// Mirrors the classic render-player-history.js Tippek view: per-match tip, actual
// result, points earned (with the ×2 favourite star) + the Wizard pick when present.
// Predictions/picks are immutable truth — nothing here writes.
export function PlayerHistoryModal({ player, onClose }: { player: string; onClose: () => void }) {
  const { session } = useGame()
  const community = session?.community ?? 'hu'
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [summary, setSummary] = useState<{ pts: number; ppg: number; exact: number } | null>(null)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(offset: number) {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        player,
        community,
        limit: String(PAGE_SIZE),
        offset: String(offset)
      })
      const res = await fetch(`/api/player-history?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json()) as HistoryResponse
      if (!res.ok || !json.ok || !json.history) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSummary(json.history.summary)
      setRows((current) => (offset === 0 ? json.history!.rows : [...current, ...json.history!.rows]))
      setNextOffset(json.history.nextOffset)
    } catch {
      setError('Nem sikerült betölteni az előzményeket.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setRows([])
    setSummary(null)
    setNextOffset(0)
    void load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, community])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(8,54,60,0.55)] backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[480px] overflow-auto rounded-t-[22px] bg-white shadow-[0_-10px_40px_rgba(8,54,60,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative px-[18px] pb-[18px] pt-4 text-white"
          style={{ background: 'linear-gradient(160deg,#073B43,#0B5560)' }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex size-[30px] items-center justify-center rounded-full bg-white/[0.16] text-[15px]"
          >
            ✕
          </button>
          <div className="text-[11px] font-extrabold tracking-[0.06em]" style={{ color: '#9fe6dd' }}>
            ELŐZMÉNYEK
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex size-[44px] items-center justify-center rounded-full bg-white/[0.16] text-[18px] font-black">
              {player[0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[18px] font-black">{player}</div>
              <div className="text-[12px] font-semibold" style={{ color: '#9fe6dd' }}>
                {Math.round(summary?.pts ?? 0)} pt · PPG {(summary?.ppg ?? 0).toFixed(1)} ·{' '}
                {summary?.exact ?? 0} telitalálat
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-7 pt-3">
          {error ? (
            <div className="py-10 text-center text-[13px] font-semibold text-[#E5484D]">{error}</div>
          ) : loading && rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-semibold text-[#0D3331]/45">Betöltés…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-semibold text-[#0D3331]/45">
              Még nincs lejátszott mérkőzés.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-[14px] border border-[#EBF6F5] bg-[#F7FBFA] px-3 py-[10px]"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="flex items-center gap-1.5 truncate text-[13px] font-bold text-[#0D3331]">
                        <span>{flag(row.home)}</span>
                        <span className="truncate">{row.home}</span>
                      </div>
                      <div className="tnum text-center text-[15px] font-black text-[#0D3331]">
                        {row.result.h}
                        <span className="mx-1 opacity-40">:</span>
                        {row.result.a}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 truncate text-[13px] font-bold text-[#0D3331]">
                        <span className="truncate text-right">{row.away}</span>
                        <span>{flag(row.away)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[#EBF6F5] pt-2">
                      <span className="text-[12px] font-semibold text-[#0D3331]/65">
                        🎯 Tipp:{' '}
                        <b className="tnum text-[#0D3331]">
                          {row.prediction.h}:{row.prediction.a}
                        </b>
                        {row.wizardPick && (
                          <span className="ml-2 text-[#0D3331]/45">🪄 {row.wizardPick}</span>
                        )}
                      </span>
                      <span className="text-[13px] font-black text-[#007E73]">
                        {row.earned?.fav && <span title="Kedvenc ×2">⭐</span>} {row.earned?.pts ?? 0} pt
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {nextOffset != null && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void load(nextOffset)}
                  className="tap mt-3 w-full rounded-[13px] border border-[#DCEFEE] bg-white px-4 py-[10px] text-[13px] font-black text-[#007E73] disabled:opacity-50"
                >
                  {loading ? 'Betöltés…' : 'Korábbi meccsek +10'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { flag, MATCH_BY_ID } from '@/lib/fixtures'
import { teamsOf } from '@/lib/derive'

// Read-only player-history modal. Opened by clicking a player on any leaderboard.
// Mirrors the classic render-player-history.js Tippek view: per-match tip, actual
// result, points earned (with the ×2 favourite star) + the Wizard pick when present.
// Predictions/picks are immutable truth — nothing here writes.
export function PlayerHistoryModal({ player, onClose }: { player: string; onClose: () => void }) {
  const { state } = useGame()
  const key = encodeClientKey(player)

  const score = state?.scores?.[key]
  const preds = state?.predictions?.[key] ?? {}
  const wizPicks = state?.wizardPicks?.[key] ?? {}
  const byMatch = score?.byMatch ?? {}

  // Only matches the player predicted that already have a final result, sorted by match id.
  const rows = Object.keys(preds)
    .map(Number)
    .filter((id) => state?.results?.[String(id)] && MATCH_BY_ID[id])
    .sort((a, b) => a - b)

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
                {Math.round(score?.pts ?? 0)} pt · PPG {(score?.ppg ?? 0).toFixed(1)} · {score?.exact ?? 0} telitalálat
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-7 pt-3">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-semibold text-[#0D3331]/45">
              Még nincs lejátszott mérkőzés.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((id) => {
                const fixture = MATCH_BY_ID[id]
                const { home, away } = teamsOf(state, fixture)
                const tip = preds[String(id)]
                const result = state!.results[String(id)]
                const m = byMatch[String(id)]
                const wiz = wizPicks[String(id)]
                return (
                  <div
                    key={id}
                    className="rounded-[14px] border border-[#EBF6F5] bg-[#F7FBFA] px-3 py-[10px]"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="flex items-center gap-1.5 truncate text-[13px] font-bold text-[#0D3331]">
                        <span>{flag(home)}</span>
                        <span className="truncate">{home}</span>
                      </div>
                      <div className="tnum text-center text-[15px] font-black text-[#0D3331]">
                        {result.h}
                        <span className="mx-1 opacity-40">:</span>
                        {result.a}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 truncate text-[13px] font-bold text-[#0D3331]">
                        <span className="truncate text-right">{away}</span>
                        <span>{flag(away)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[#EBF6F5] pt-2">
                      <span className="text-[12px] font-semibold text-[#0D3331]/65">
                        🎯 Tipp: <b className="tnum text-[#0D3331]">{tip.h}:{tip.a}</b>
                        {wiz?.pick && <span className="ml-2 text-[#0D3331]/45">🪄 {wiz.pick}</span>}
                      </span>
                      <span className="text-[13px] font-black text-[#007E73]">
                        {m?.fav && <span title="Kedvenc ×2">⭐</span>} {m?.pts ?? 0} pt
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

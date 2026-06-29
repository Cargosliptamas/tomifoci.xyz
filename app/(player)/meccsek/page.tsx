'use client'

import { useMemo } from 'react'
import { PageHeader } from '@/components/page-header'
import { LiveCard, FinishedCard } from '@/components/broadcast-card'
import { MatchCard } from '@/components/match-card'
import { useGame } from '@/components/game-provider'
import { MATCHES } from '@/lib/fixtures'
import { bucketFixtures } from '@/lib/derive'

export default function MeccsekPage() {
  const { state, status, lastUpdated, refresh } = useGame()

  const buckets = useMemo(() => bucketFixtures(state, MATCHES), [state])
  const openSoon = buckets.open.slice(0, 24)
  const finishedRecent = buckets.finished.slice(0, 10)

  return (
    <>
      <PageHeader eyebrow="TIPPELÉS" title="Tippjeim" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {/* Data freshness */}
        <div className="mb-3 flex items-center justify-between rounded-[12px] border border-[#DCEFEE] bg-white px-[13px] py-2">
          <span className="flex items-center gap-2 text-xs font-bold text-[#15803d]">
            <span className="size-2 rounded-full bg-[#34C759]" />
            {status === 'ready' ? `Élő adatok · frissítve ${freshness(lastUpdated)}` : status === 'loading' ? 'Betöltés…' : 'Offline — utolsó állás'}
          </span>
          <button onClick={() => void refresh()} className="tap text-[11px] font-semibold text-[#0D3331]/50 hover:text-[#007E73]">
            ⟳ frissítés
          </button>
        </div>

        {status === 'error' && (
          <div className="mb-4 rounded-[14px] bg-[#fff4e6] px-4 py-3 text-[13px] font-semibold text-[#9a6b00]">
            Nem érhető el az adatbázis. Állítsd be a <span className="mono">DATABASE_URL</span> változót a Vercelben.
          </div>
        )}

        {status === 'loading' && <Skeleton />}

        {/* ÉLŐ MOST */}
        {buckets.live.length > 0 && (
          <section className="mb-5">
            <div className="mb-[10px] flex items-center gap-[7px]">
              <span className="live-dot size-[9px] rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]" />
              <span className="text-xs font-black tracking-[0.06em]">ÉLŐ MOST</span>
            </div>
            {buckets.live.map((f) => (
              <LiveCard key={f.id} fixture={f} />
            ))}
          </section>
        )}

        {/* MA · TIPPELHETŐ */}
        {openSoon.length > 0 && (
          <section>
            <div className="mb-[10px] text-xs font-black tracking-[0.06em] text-[#0D3331]/50">TIPPELHETŐ</div>
            {openSoon.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </section>
        )}

        {/* BEFEJEZETT */}
        {finishedRecent.length > 0 && (
          <section className="mt-2">
            <div className="mb-[10px] mt-[18px] text-xs font-black tracking-[0.06em] text-[#0D3331]/50">BEFEJEZETT</div>
            {finishedRecent.map((f) => (
              <FinishedCard key={f.id} fixture={f} />
            ))}
          </section>
        )}

        {status === 'ready' && !buckets.live.length && !openSoon.length && !finishedRecent.length && (
          <div className="py-12 text-center text-[14px] text-[#0D3331]/50">Nincs megjeleníthető mérkőzés.</div>
        )}
      </div>
    </>
  )
}

function freshness(ts: number | null): string {
  if (!ts) return 'most'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s} mp`
  return `${Math.round(s / 60)} p`
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[58px] animate-pulse rounded-[18px] bg-white/70" />
      ))}
    </div>
  )
}

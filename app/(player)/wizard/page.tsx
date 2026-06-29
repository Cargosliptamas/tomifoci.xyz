'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { WizBoard } from '@/components/standings-ui'
import { MATCHES, flag } from '@/lib/fixtures'
import { statusOf, oddsFor, myWizard, myPrediction, teamsOf } from '@/lib/derive'

type Pick = '1' | 'X' | '2'

export default function WizardPage() {
  const { state, session, status } = useGame()
  const me = session?.player ?? ''
  const [tab, setTab] = useState<'play' | 'table'>('play')

  return (
    <>
      <PageHeader eyebrow="🪄 Wizard of ODDS" title="Wizard" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        <div className="mb-4 flex rounded-[14px] bg-white p-1 surface-card">
          {(['play', 'table'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tap flex-1 rounded-[10px] px-1 py-[10px] text-[12px] font-extrabold ${tab === t ? '' : 'text-[#0D3331]/60'}`}
              style={tab === t ? { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' } : undefined}
            >
              {t === 'play' ? '🪄 Tippek' : '🏆 Rangsor'}
            </button>
          ))}
        </div>

        {tab === 'table' ? (
          status === 'loading' ? (
            <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>
          ) : (
            <WizBoard rows={state?.wizardRankings ?? []} me={me} />
          )
        ) : (
          <WizardPlay />
        )}

        <p className="mt-4 px-1 text-[11px] leading-[1.5] text-[#0D3331]/50">
          A Wizard-tipp alapból az eredmény-tippedből tükröződik (Varázslótanonc). Itt felülírhatod
          bármelyik meccsre. A helyes 1/X/2 a leadáskori oddst éri, az [1,10–10,00] sávra vágva.
        </p>
      </div>
    </>
  )
}

function mirrorPick(pred: { h: number; a: number } | null): Pick | null {
  if (!pred) return null
  return pred.h > pred.a ? '1' : pred.h < pred.a ? '2' : 'X'
}

function WizardPlay() {
  const { state } = useGame()
  const open = useMemo(
    () => MATCHES.filter((f) => statusOf(state, f) === 'open').sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(0, 30),
    [state]
  )
  if (!open.length) return <div className="py-10 text-center text-[13px] text-[#0D3331]/45">Nincs jelenleg tippelhető meccs.</div>
  return (
    <div className="space-y-2.5">
      {open.map((f) => (
        <WizardRow key={f.id} fixtureId={f.id} />
      ))}
    </div>
  )
}

function WizardRow({ fixtureId }: { fixtureId: number }) {
  const { state, session, saveWizard } = useGame()
  const me = session?.player ?? ''
  const f = MATCHES.find((m) => m.id === fixtureId)!
  const { home, away } = teamsOf(state, f)
  const odds = oddsFor(state, fixtureId)
  const saved = me ? myWizard(state, me, fixtureId) : null
  const pred = me ? myPrediction(state, me, fixtureId) : null
  const current: Pick | null = saved?.pick ?? mirrorPick(pred)
  const mirrored = !saved?.pick && current != null
  const [busy, setBusy] = useState(false)

  async function pick(p: Pick) {
    if (busy) return
    setBusy(true)
    await saveWizard(fixtureId, p, odds ? odds[p === '1' ? 0 : p === 'X' ? 1 : 2] : null)
    setBusy(false)
  }

  return (
    <div className="rounded-[14px] bg-white p-3 surface-card">
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold">
        <span>{flag(home)}</span>
        <span className="truncate">{home}</span>
        <span className="text-[#0D3331]/30">–</span>
        <span className="truncate">{away}</span>
        <span>{flag(away)}</span>
        {mirrored && <span className="ml-auto text-[10px] font-extrabold text-[#0D3331]/40">tükrözött</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['1', 'X', '2'] as const).map((p, i) => (
          <button
            key={p}
            disabled={busy}
            onClick={() => pick(p)}
            className={`tap rounded-[11px] px-1 py-2 text-center ${current === p ? 'broadcast-info' : 'border border-[#DCEFEE] bg-white text-[#0D3331] hover:border-[#bfe4df]'}`}
          >
            <div className="text-[11px] font-black">{p}</div>
            <div className="tnum mt-px text-[14px] font-black">{odds ? odds[i].toFixed(2) : '—'}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

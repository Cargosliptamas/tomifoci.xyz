'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import type { RankingRow, WizardRankRow, SwissStanding } from '@/lib/types'

const MODES = [
  { id: 'tip', icon: '🎯', label: 'Tipp' },
  { id: 'wiz', icon: '🪄', label: 'Wizard' },
  { id: 'swiss', icon: '♟', label: 'Svájci' }
] as const

const SCOPES = [
  { id: 'all', label: '🌐 Összes' },
  { id: 'vb', label: '🏆 VB-teljes' },
  { id: 'group', label: '📊 Csoportkör' },
  { id: 'ko', label: '🔥 Kiesés' },
  { id: 'test', label: '⚽ Teszt liga' }
] as const

export default function TabellaPage() {
  const { state, session, status } = useGame()
  const me = session?.player ?? ''
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('tip')
  const [scope, setScope] = useState('all')

  return (
    <>
      <PageHeader eyebrow="Rangsorok" title="Tabella" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {/* mode switch */}
        <div className="mb-4 flex rounded-[14px] bg-white p-1 shadow-[0_4px_16px_rgba(13,51,49,0.06)]">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 rounded-[10px] px-1 py-[10px] text-[12px] font-extrabold ${mode === m.id ? '' : 'text-[#0D3331]/60'}`}
              style={mode === m.id ? { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' } : undefined}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {status === 'loading' && <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>}

        {mode === 'tip' && (
          <TipBoard rankings={state?.rankings ?? {}} scope={scope} setScope={setScope} me={me} />
        )}
        {mode === 'wiz' && <WizBoard rows={state?.wizardRankings ?? []} me={me} />}
        {mode === 'swiss' && <SwissBoard standings={state?.swiss?.standings ?? []} me={me} />}
      </div>
    </>
  )
}

function TipBoard({
  rankings,
  scope,
  setScope,
  me
}: {
  rankings: Record<string, RankingRow[]>
  scope: string
  setScope: (s: string) => void
  me: string
}) {
  const rows = rankings[encodeClientKey(`${scope}_Mindenki`)] ?? []
  return (
    <>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`flex-none whitespace-nowrap rounded-full px-4 py-[9px] text-[13px] font-bold ${
              scope === s.id ? '' : 'border border-[#DCEFEE] bg-white text-[#0D3331]/70'
            }`}
            style={scope === s.id ? { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mb-[9px] text-[11px] font-semibold text-[#0D3331]/50">
        Holtverseny: pont → telitalálat → PPG · a bónusz csak a kieséses nézetekben számít
      </div>
      <Board>
        {rows.length === 0 && <Empty />}
        {rows.map((r, i) => (
          <Row key={r.name} me={me} name={r.name}>
            <Rank n={i + 1} />
            <Avatar name={r.name} />
            <span className="flex-1 truncate text-[14px] font-bold">{r.name}</span>
            <div className="text-right">
              <div className="tnum text-[17px] font-black">{Math.round(r.pts)}</div>
              <div className="text-[11px] font-semibold text-[#0D3331]/55">
                PPG {(r.ppg ?? 0).toFixed(1)} · {r.exact} telitalálat
              </div>
            </div>
          </Row>
        ))}
      </Board>
    </>
  )
}

function WizBoard({ rows, me }: { rows: WizardRankRow[]; me: string }) {
  return (
    <>
      <div className="broadcast-info mb-[14px] rounded-[14px] px-[14px] py-3 text-xs font-semibold">
        🪄 Wizard-rangsor — a leadáskori oddsok összege, az [1,1–10] sávra vágva. Pontosság = talált tippek aránya.
      </div>
      <Board>
        {rows.length === 0 && <Empty />}
        {rows.map((r, i) => (
          <Row key={r.name} me={me} name={r.name}>
            <Rank n={r.place ?? i + 1} />
            <span className="flex-1 truncate text-[14px] font-bold">{r.name}</span>
            <span className="w-[84px] text-center text-xs font-bold text-[#0D3331]/55">
              {r.accuracy ?? 0}% · {r.played ?? 0}
            </span>
            <span className="tnum w-14 text-right text-[16px] font-black text-[#007E73]">{(r.pts ?? 0).toFixed(2)}</span>
          </Row>
        ))}
      </Board>
    </>
  )
}

function SwissBoard({ standings, me }: { standings: SwissStanding[]; me: string }) {
  return (
    <>
      <div className="broadcast-info mb-[14px] rounded-[14px] px-[14px] py-3 text-xs font-semibold">
        ♟ Svájci állás — M = mérleg (Gy-D-V), MP = mérkőzéspont. Holtverseny: MP → tipppont → egymás elleni → Buchholz.
      </div>
      <Board>
        {standings.length === 0 && <Empty />}
        {standings.map((r, i) => (
          <Row key={r.name} me={me} name={r.name}>
            <Rank n={r.place ?? i + 1} />
            <span className="flex-1 truncate text-[14px] font-bold">{r.name}</span>
            <span className="w-[46px] text-center text-xs font-bold text-[#0D3331]/55">
              {r.w ?? 0}-{r.d ?? 0}-{r.l ?? 0}
            </span>
            <span className="tnum w-[34px] text-right text-[15px] font-black text-[#007E73]">{r.mp ?? 0}</span>
          </Row>
        ))}
      </Board>
    </>
  )
}

function Board({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_4px_16px_rgba(13,51,49,0.06)]">{children}</div>
}
function Row({ me, name, children }: { me: string; name: string; children: React.ReactNode }) {
  const isMe = name === me
  return (
    <div
      className="flex items-center gap-[10px] border-b border-[#EBF6F5] px-4 py-3 last:border-b-0"
      style={isMe ? { background: 'rgba(20,160,140,0.1)', borderLeft: '3px solid #14a08c' } : undefined}
    >
      {children}
    </div>
  )
}
function Rank({ n }: { n: number }) {
  return <span className="w-[22px] text-center text-[14px] font-extrabold text-[#0D3331]/55">{n}.</span>
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-[34px] items-center justify-center rounded-full bg-[#EBF6F5] text-[13px] font-black text-[#007E73]">
      {name[0]}
    </span>
  )
}
function Empty() {
  return <div className="px-4 py-10 text-center text-[13px] text-[#0D3331]/45">Még nincs rangsor adat.</div>
}

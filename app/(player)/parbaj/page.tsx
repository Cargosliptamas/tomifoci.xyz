'use client'

import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { SwissBoard } from '@/components/standings-ui'
import { Bracket } from '@/components/bracket'

export default function ParbajPage() {
  const { state, session, status } = useGame()
  const me = session?.player ?? ''
  const round = state?.swiss?.round
  const frozen = state?.swiss?.frozen

  return (
    <>
      <PageHeader eyebrow="♟ Svájci párbaj" title="Párbaj" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {round != null && (
          <div className="mb-3 flex items-center justify-between rounded-[12px] bg-white px-[14px] py-2.5 surface-card">
            <span className="text-[13px] font-extrabold">{frozen ? 'Befagyasztva' : `${round}. forduló`}</span>
            <span className="text-[11px] font-semibold text-[#0D3331]/55">
              {frozen ? '10. forduló után — ez adja a rájátszás kiemelést' : 'a kör 8 meccsének alappontja számít'}
            </span>
          </div>
        )}

        {/* Current-round matchups */}
        {round != null && <Matchups me={me} round={round} pairings={state?.swissPairings ?? []} />}

        {status === 'loading' ? (
          <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>
        ) : (
          <SwissBoard standings={state?.swiss?.standings ?? []} me={me} />
        )}

      </div>

      <div className="mt-5">
        <div className="mb-2 px-[18px] text-xs font-black tracking-[0.06em] text-[#0D3331]/55">
          ♟ RÁJÁTSZÁS ÁGRAJZ (TOP 32)
        </div>
        <Bracket variant="parbaj" />
      </div>
    </>
  )
}

function Matchups({
  me,
  round,
  pairings
}: {
  me: string
  round: number
  pairings: Array<{ round: number; a: string; b: string }>
}) {
  const thisRound = pairings.filter((p) => p.round === round)
  if (!thisRound.length) return null
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-black tracking-[0.06em] text-[#0D3331]/55">
        ⚔️ {round}. FORDULÓ PÁROSÍTÁSAI
      </div>
      <div className="overflow-hidden rounded-[14px] bg-white surface-card">
        {thisRound.map((p, i) => {
          const mine = p.a === me || p.b === me
          const isBye = !p.b || p.b === 'bye' || p.b === '—'
          return (
            <div
              key={`${p.a}-${p.b}-${i}`}
              className="flex items-center gap-2 border-b border-[#EBF6F5] px-4 py-2.5 text-[13px] last:border-b-0"
              style={mine ? { background: 'rgba(20,160,140,0.1)', borderLeft: '3px solid #14a08c' } : undefined}
            >
              <span className={`flex-1 text-right ${p.a === me ? 'font-black text-[#007E73]' : 'font-bold'}`}>{p.a}</span>
              <span className="px-2 text-[11px] font-black text-[#0D3331]/40">{isBye ? '—' : 'vs'}</span>
              <span className={`flex-1 ${p.b === me ? 'font-black text-[#007E73]' : 'font-bold'}`}>{isBye ? 'erőnyerő' : p.b}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

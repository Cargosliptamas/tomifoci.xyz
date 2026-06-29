'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { SwissBoard } from '@/components/standings-ui'

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

        {status === 'loading' ? (
          <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>
        ) : (
          <SwissBoard standings={state?.swiss?.standings ?? []} me={me} />
        )}

        <Link
          href="/brackets"
          className="tap mt-4 flex w-full items-center justify-center rounded-[13px] border border-[#cfe0de] bg-white py-3 text-[13px] font-extrabold text-[#007E73] hover:bg-[#F7FBFA]"
        >
          ♟ Rájátszás ágrajz (Top 32) →
        </Link>
      </div>
    </>
  )
}

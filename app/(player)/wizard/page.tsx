'use client'

import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { WizBoard } from '@/components/standings-ui'

export default function WizardPage() {
  const { state, session, status } = useGame()
  const me = session?.player ?? ''

  return (
    <>
      <PageHeader eyebrow="🪄 Wizard of ODDS" title="Wizard" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {status === 'loading' ? (
          <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>
        ) : (
          <WizBoard rows={state?.wizardRankings ?? []} me={me} />
        )}
        <p className="mt-4 px-1 text-[11px] leading-[1.5] text-[#0D3331]/50">
          A Wizard tippeket a Meccsek kártyán adod le (1 / X / 2). Alapból a tipped eredményéből tükröződik
          automatikusan — a leadáskori odds rögzül, és a helyes tipp annyi pontot ér.
        </p>
      </div>
    </>
  )
}

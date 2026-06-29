'use client'

import Link from 'next/link'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { state, session } = useGame()
  const me = session?.player ?? ''
  const score = me ? state?.scores?.[encodeClientKey(me)] : undefined
  const pts = Math.round(score?.pts ?? 0)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#DCEFEE]/80 bg-[#EAF6F5]/[0.86] px-[18px] pb-3 pt-4 backdrop-blur-md">
      <div>
        <div className="eyebrow tracking-[0.14em]">{eyebrow}</div>
        <h1 className="text-[21px] font-black tracking-[-0.01em]">{title}</h1>
      </div>
      <Link
        href="/profil"
        className="flex items-center gap-2 rounded-full bg-white py-[5px] pl-3 pr-[6px] shadow-[0_2px_8px_rgba(13,51,49,0.06)]"
      >
        <span className="tnum text-[13px] font-extrabold">{pts} pt</span>
        <span
          className="flex size-[30px] items-center justify-center rounded-full text-[13px] font-black text-white"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)' }}
        >
          {me ? me[0] : '?'}
        </span>
      </Link>
    </header>
  )
}

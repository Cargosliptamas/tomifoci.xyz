'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/page-header'

const RULES = {
  parbaj: {
    title: '♟ PÁRBAJ RÁJÁTSZÁS — SZABÁLYOK',
    items: [
      ['🥇', 'Felső 32 jut be', 'A 10. forduló utáni befagyasztott tabella adja a kiemelést — az 1–32. helyezett játszik 5 körös egyenes kieséssel.'],
      ['⚔️', 'Párbaj = alappont', 'Egy körben a 8 meccsre adott alappontod (0–40) száll szembe az ellenfeleddel; több pont továbbjut.'],
      ['🤝', 'Döntetlennél a kiemeltebb', 'Ha a két párbajpont egyenlő, a magasabban kiemelt játékos jut tovább.'],
      ['🪜', 'Mindenki helyezést kap', 'A kieső is tovább játszik a vigaszágon, így a teljes mezőny 1–32. helyig rangsorolódik.']
    ]
  },
  wc: {
    title: '🏆 VB KIESÉS — TUDNIVALÓK',
    items: [
      ['⏱️', 'A 90 perc dönt', 'Pontozáshoz a rendes játékidő eredménye számít; a hosszabbítás/tizenegyesek a továbbjutást döntik, a tipppontokat nem.'],
      ['🎯', 'Élő tipppont a fán', 'Minden meccskártya mutatja a tipped és az aktuálisan elérhető pont állását.'],
      ['🥉', 'Bronzmeccs', 'A két elődöntős vesztes játszik a 3. helyért — ez is tippelhető és pontozott.'],
      ['🪜', 'Vigaszág (terv)', 'A kieső csapatok helyosztó ágon folytatják, hogy a teljes 5–32. helyezés is kirajzolódjon.']
    ]
  }
} as const

export default function BracketsPage() {
  const [tab, setTab] = useState<'parbaj' | 'wc'>('parbaj')
  const rules = RULES[tab]

  return (
    <>
      <PageHeader eyebrow="Kieséses ágrajz" title="Brackets" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        <div className="mb-4 flex rounded-[13px] bg-white p-1 shadow-[0_2px_10px_rgba(13,51,49,0.07)]">
          {(['parbaj', 'wc'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-[10px] px-1 py-[9px] text-[13px] font-extrabold ${tab === id ? '' : 'text-[#0D3331]/60'}`}
              style={tab === id ? { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' } : undefined}
            >
              {id === 'parbaj' ? '♟ Párbaj rájátszás' : '🏆 VB kiesés'}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-[14px] bg-[#fff4e6] px-4 py-3 text-[13px] font-semibold text-[#9a6b00]">
          Az interaktív ágrajz a 10. forduló utáni befagyasztott kiemelésből épül — a vizuális fa
          a valós eredmények beérkezésekor jelenik meg. Addig a szabályok láthatók.
        </div>

        <div className="rounded-[18px] p-[18px] text-[#eaf7f6]" style={{ background: 'linear-gradient(160deg,#1d6b74,#14525a)' }}>
          <div className="mb-3 text-xs font-black tracking-[0.08em]">{rules.title}</div>
          <div className="grid gap-[14px] sm:grid-cols-2">
            {rules.items.map(([icon, head, body]) => (
              <div key={head} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-[26px] items-center justify-center rounded-[8px] bg-white/10 text-[14px]">{icon}</span>
                  <span className="text-[13px] font-extrabold text-white">{head}</span>
                </div>
                <span className="text-xs leading-[1.45]" style={{ color: '#cfeae8' }}>
                  {body}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

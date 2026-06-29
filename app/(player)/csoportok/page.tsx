'use client'

import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { flag } from '@/lib/fixtures'
import { groupTables, bestThirds } from '@/lib/groups'

export default function CsoportokPage() {
  const { state, status } = useGame()
  const tables = groupTables(state)
  const thirds = bestThirds(tables)

  return (
    <>
      <PageHeader eyebrow="Csoportkör" title="Csoportok" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {status === 'loading' && <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>}

        <div className="mb-3 text-[11px] font-semibold text-[#0D3331]/50">
          Csoportonként az első 2 továbbjut (🟢) · a 8 legjobb harmadik (🟠) is. 12 csoport · 48 csapat.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tables.map(({ group, rows }) => (
            <div key={group} className="overflow-hidden rounded-[14px] bg-white surface-card">
              <div className="flex items-center justify-between border-b border-[#EBF6F5] bg-[#f6faf9] px-[14px] py-[10px]">
                <span className="text-[13px] font-black">{group} csoport</span>
                <span className="text-[10px] font-bold text-[#0D3331]/40">GK · PONT</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.team}
                  className="flex items-center gap-[9px] border-b border-[#F1F5F5] px-3 py-[9px] last:border-b-0"
                  style={{ borderLeft: `3px solid ${r.pos <= 2 ? '#34C759' : r.pos === 3 ? '#FF9500' : 'transparent'}` }}
                >
                  <span
                    className="w-[18px] text-center text-xs font-extrabold"
                    style={{ color: r.pos <= 2 ? '#15803d' : r.pos === 3 ? '#9a6b00' : 'rgba(13,51,49,0.4)' }}
                  >
                    {r.pos}
                  </span>
                  <span className="text-[15px]">{flag(r.team)}</span>
                  <span className="flex-1 truncate text-[13px] font-bold">{r.team}</span>
                  <span className="tnum w-[30px] text-center text-[11px] font-semibold text-[#0D3331]/50">
                    {r.gd > 0 ? `+${r.gd}` : r.gd}
                  </span>
                  <span className="tnum w-[22px] text-right text-[14px] font-black text-[#007E73]">{r.pts}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mb-[10px] mt-5 text-xs font-black tracking-[0.06em] text-[#0D3331]/55">
          🟠 LEGJOBB HARMADIKOK · 8 továbbjutó hely
        </div>
        <div className="overflow-hidden rounded-[16px] bg-white surface-card">
          {thirds.map((r, i) => (
            <div
              key={`${r.group}-${r.team}`}
              className="flex items-center gap-[9px] border-b border-[#F1F5F5] px-[14px] py-[10px] last:border-b-0"
              style={i >= 8 ? { opacity: 0.5 } : undefined}
            >
              <span className="w-6 text-center text-[13px] font-extrabold text-[#0D3331]/45">{i + 1}</span>
              <span className="text-[15px]">{flag(r.team)}</span>
              <span className="flex-1 truncate text-[13px] font-bold">
                {r.team} <span className="font-semibold text-[#0D3331]/40">· {r.group}</span>
              </span>
              <span className="tnum w-[30px] text-center text-[11px] font-semibold text-[#0D3331]/50">
                {r.gd > 0 ? `+${r.gd}` : r.gd}
              </span>
              <span className="tnum w-[22px] text-center text-[13px] font-black">{r.pts}</span>
              <span
                className="rounded-full px-2 py-[2px] text-[11px] font-bold"
                style={i < 8 ? { color: '#15803d', background: '#e9f6ee' } : { color: 'rgba(13,51,49,0.45)', background: '#EBF0F0' }}
              >
                {i < 8 ? '✓' : '✗'}
              </span>
            </div>
          ))}
          {!thirds.length && <div className="px-4 py-8 text-center text-[13px] text-[#0D3331]/45">Még nincs csoporteredmény.</div>}
        </div>
      </div>
    </>
  )
}

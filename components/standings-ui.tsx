'use client'

import { useState } from 'react'
import type { WizardRankRow, SwissStanding } from '@/lib/types'
import { PlayerHistoryModal } from '@/components/player-history-modal'

export function Board({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[16px] bg-white surface-card">{children}</div>
}

export function Row({
  me,
  name,
  onPlayer,
  children
}: {
  me: string
  name: string
  onPlayer?: (name: string) => void
  children: React.ReactNode
}) {
  const isMe = name === me
  return (
    <div
      className={`tap flex items-center gap-[10px] border-b border-[#EBF6F5] px-4 py-3 text-left last:border-b-0 ${
        onPlayer && !isMe ? 'hover:bg-[#F7FBFA]' : ''
      }`}
      style={isMe ? { background: 'rgba(20,160,140,0.1)', borderLeft: '3px solid #14a08c' } : undefined}
      role={onPlayer ? 'button' : undefined}
      onClick={onPlayer ? () => onPlayer(name) : undefined}
    >
      {children}
    </div>
  )
}

export function Rank({ n }: { n: number }) {
  return <span className="w-[22px] text-center text-[14px] font-extrabold text-[#0D3331]/55">{n}.</span>
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-[34px] items-center justify-center rounded-full bg-[#EBF6F5] text-[13px] font-black text-[#007E73]">
      {name[0]}
    </span>
  )
}

export function Empty() {
  return <div className="px-4 py-10 text-center text-[13px] text-[#0D3331]/45">Még nincs rangsor adat.</div>
}

export function WizBoard({ rows, me }: { rows: WizardRankRow[]; me: string }) {
  const [player, setPlayer] = useState<string | null>(null)
  return (
    <>
      <div className="broadcast-info mb-[14px] rounded-[14px] px-[14px] py-3 text-xs font-semibold">
        🪄 Wizard-rangsor — a leadáskori oddsok összege, az [1,1–10] sávra vágva. Pontosság = talált tippek aránya.
      </div>
      <Board>
        {rows.length === 0 && <Empty />}
        {rows.map((r, i) => (
          <Row key={r.name} me={me} name={r.name} onPlayer={setPlayer}>
            <Rank n={r.place ?? i + 1} />
            <span className="flex-1 truncate text-[14px] font-bold">{r.name}</span>
            <span className="w-[84px] text-center text-xs font-bold text-[#0D3331]/55">
              {r.accuracy ?? 0}% · {r.played ?? 0}
            </span>
            <span className="tnum w-14 text-right text-[16px] font-black text-[#007E73]">{(r.pts ?? 0).toFixed(2)}</span>
          </Row>
        ))}
      </Board>
      {player && <PlayerHistoryModal player={player} onClose={() => setPlayer(null)} />}
    </>
  )
}

export function SwissBoard({ standings, me }: { standings: SwissStanding[]; me: string }) {
  const [player, setPlayer] = useState<string | null>(null)
  return (
    <>
      <div className="broadcast-info mb-[14px] rounded-[14px] px-[14px] py-3 text-xs font-semibold">
        ♟ Párbaj-állás — M = mérleg (Gy-D-V), MP = mérkőzéspont. Holtverseny: MP → tipppont → egymás elleni → Buchholz.
      </div>
      <Board>
        {standings.length === 0 && <Empty />}
        {standings.map((r, i) => (
          <Row key={r.name} me={me} name={r.name} onPlayer={setPlayer}>
            <Rank n={r.place ?? i + 1} />
            <span className="flex-1 truncate text-[14px] font-bold">{r.name}</span>
            <span className="w-[46px] text-center text-xs font-bold text-[#0D3331]/55">
              {r.w ?? 0}-{r.d ?? 0}-{r.l ?? 0}
            </span>
            <span className="tnum w-[34px] text-right text-[15px] font-black text-[#007E73]">{r.mp ?? 0}</span>
          </Row>
        ))}
      </Board>
      {player && <PlayerHistoryModal player={player} onClose={() => setPlayer(null)} />}
    </>
  )
}

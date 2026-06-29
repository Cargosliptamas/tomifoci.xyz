'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { flag } from '@/lib/fixtures'
import { groupTables, bestThirds } from '@/lib/groups'
import { Board, Row, Rank, Avatar, Empty } from '@/components/standings-ui'
import { PlayerHistoryModal } from '@/components/player-history-modal'
import type { GameState, RankingRow } from '@/lib/types'

const MODES = [
  { id: 'tip', icon: '🎯', label: 'Tippjáték' },
  { id: 'group', icon: '📊', label: 'Csoportok' }
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
        {mode === 'group' && <GroupBoard state={state} />}
      </div>
    </>
  )
}

function GroupBoard({ state }: { state: GameState | null }) {
  const tables = groupTables(state)
  const thirds = bestThirds(tables)
  return (
    <>
      <div className="mb-3 text-[11px] font-semibold text-[#0D3331]/50">
        Csoportonként az első 2 továbbjut (🟢) · a 8 legjobb harmadik (🟠) is. 12 csoport · 48 csapat.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tables.map(({ group, rows }) => (
          <div key={group} className="overflow-hidden rounded-[14px] bg-white shadow-[0_4px_16px_rgba(13,51,49,0.06)]">
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
      <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_4px_16px_rgba(13,51,49,0.06)]">
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
  const [player, setPlayer] = useState<string | null>(null)
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
          <Row key={r.name} me={me} name={r.name} onPlayer={setPlayer}>
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
      {player && <PlayerHistoryModal player={player} onClose={() => setPlayer(null)} />}
    </>
  )
}


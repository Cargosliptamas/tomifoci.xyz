'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { Board, Row, Rank, Avatar, Empty } from '@/components/standings-ui'
import { PlayerHistoryModal } from '@/components/player-history-modal'
import type { RankingRow } from '@/lib/types'

const SCOPES = [
  { id: 'all', label: '🌐 Összes' },
  { id: 'vb', label: '🏆 VB-teljes' },
  { id: 'group', label: '📊 Csoportkör' },
  { id: 'ko', label: '🔥 Kiesés' }
] as const

export default function RanglistaPage() {
  const { state, session, status } = useGame()
  const me = session?.player ?? ''
  const [scope, setScope] = useState('all')
  const leagues = state?.settings.leagues?.length ? state.settings.leagues : ['Mindenki']
  const [league, setLeague] = useState('Mindenki')

  useEffect(() => {
    if (!leagues.includes(league)) setLeague(leagues[0] ?? 'Mindenki')
  }, [league, leagues])

  return (
    <>
      <PageHeader eyebrow="Tippverseny" title="Ranglista" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {status === 'loading' && (
          <div className="py-12 text-center text-[14px] text-[#0D3331]/40">Betöltés…</div>
        )}

        <TipBoard
          rankings={state?.rankings ?? {}}
          scope={scope}
          setScope={setScope}
          leagues={leagues}
          league={league}
          setLeague={setLeague}
          me={me}
        />
      </div>
    </>
  )
}

function TipBoard({
  rankings,
  scope,
  setScope,
  leagues,
  league,
  setLeague,
  me
}: {
  rankings: Record<string, RankingRow[]>
  scope: string
  setScope: (s: string) => void
  leagues: string[]
  league: string
  setLeague: (s: string) => void
  me: string
}) {
  const selectedLeague = leagues.includes(league) ? league : (leagues[0] ?? 'Mindenki')
  const rows = rankings[encodeClientKey(`${scope}_${selectedLeague}`)] ?? []
  const [player, setPlayer] = useState<string | null>(null)
  return (
    <>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`tap flex-none whitespace-nowrap rounded-full px-4 py-[9px] text-[13px] font-bold ${
              scope === s.id
                ? ''
                : 'border border-[#DCEFEE] bg-white text-[#0D3331]/70 hover:border-[#bfe4df]'
            }`}
            style={
              scope === s.id
                ? { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }
                : undefined
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      {leagues.length > 1 && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
          {leagues.map((l) => (
            <button
              key={l}
              onClick={() => setLeague(l)}
              className={`tap flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-bold ${
                selectedLeague === l
                  ? 'bg-[#EBF6F5] text-[#007E73]'
                  : 'border border-[#DCEFEE] bg-white text-[#0D3331]/65'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
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

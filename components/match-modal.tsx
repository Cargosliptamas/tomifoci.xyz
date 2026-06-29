'use client'

import { useEffect, useState } from 'react'
import { flag, type Fixture } from '@/lib/fixtures'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { myPrediction, myWizard, oddsFor, resultFor, teamsOf } from '@/lib/derive'

type MatchEvent = { minute: string; type: string; player: string; team: 'h' | 'a' }
type LineupPlayer = { num: string; name: string }
type MatchCentre = {
  events: MatchEvent[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] } | null
}

// type → icon for the events list (mirrors the classic render-matchcentre.js icons).
const EVENT_ICON: Record<string, string> = {
  goal: '⚽',
  goal_penalty: '⚽',
  own_goal: '⚽',
  yellow: '🟨',
  red: '🟥',
  yellow_red: '🟨🟥',
  sub: '🔄',
  missed_penalty: '✗'
}
const EVENT_SUFFIX: Record<string, string> = { goal_penalty: ' (11m)', own_goal: ' (ög)', missed_penalty: ' (11m)' }

export function MatchModal({ fixture, live, onClose }: { fixture: Fixture; live: boolean; onClose: () => void }) {
  const { state, session } = useGame()
  const me = session?.player ?? ''
  const [tab, setTab] = useState<'sum' | 'ev' | 'lu' | 'odds'>('sum')
  const [mc, setMc] = useState<MatchCentre | null>(null)
  const [mcLoading, setMcLoading] = useState(true)

  // Fetch live match-centre data (events + lineups) once, when the modal opens.
  useEffect(() => {
    let alive = true
    setMcLoading(true)
    fetch(`/api/match/${fixture.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return
        setMc({ events: json.events ?? [], lineups: json.lineups ?? null })
      })
      .catch(() => {
        if (alive) setMc({ events: [], lineups: null })
      })
      .finally(() => {
        if (alive) setMcLoading(false)
      })
    return () => {
      alive = false
    }
  }, [fixture.id])

  const result = resultFor(state, fixture.id)
  const pred = me ? myPrediction(state, me, fixture.id) : null
  const wiz = me ? myWizard(state, me, fixture.id) : null
  const odds = oddsFor(state, fixture.id)
  const earned = me ? state?.scores?.[encodeClientKey(me)]?.byMatch?.[String(fixture.id)] : undefined
  const { home, away } = teamsOf(state, fixture)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(8,54,60,0.55)] backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[480px] overflow-auto rounded-t-[22px] bg-white shadow-[0_-10px_40px_rgba(8,54,60,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative px-[18px] pb-[18px] pt-4 text-white"
          style={{ background: live ? 'linear-gradient(160deg,#0C4D49,#0F6A64)' : 'linear-gradient(160deg,#073B43,#0B5560)' }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex size-[30px] items-center justify-center rounded-full bg-white/[0.16] text-[15px]"
          >
            ✕
          </button>
          <div className="text-[11px] font-extrabold tracking-[0.06em]" style={{ color: '#9fe6dd' }}>
            {fixture.group && fixture.group !== '–' ? `${fixture.group.toUpperCase()} CSOPORT` : (fixture.label ?? 'MECCS')} · {live ? 'ÉLŐ' : 'VÉGE'}
          </div>
          <div className="my-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div className="text-center">
              <div className="text-[32px]">{flag(home)}</div>
              <div className="text-[13px] font-bold">{home}</div>
            </div>
            <div className="tnum text-[34px] font-black">
              {result?.h ?? '–'}
              <span className="mx-1.5 opacity-50">:</span>
              {result?.a ?? '–'}
            </div>
            <div className="text-center">
              <div className="text-[32px]">{flag(away)}</div>
              <div className="text-[13px] font-bold">{away}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 border-b border-[#EBF6F5] px-4 py-3">
          {([
            ['sum', 'Összefoglaló'],
            ['ev', 'Események'],
            ['lu', 'Felállás'],
            ['odds', 'Odds']
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-[10px] px-1 py-[9px] text-[12px] font-extrabold ${
                tab === id ? 'bg-[#EBF6F5] text-[#007E73]' : 'text-[#0D3331]/55'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-7 pt-3">
          {tab === 'sum' && (
            <div className="space-y-2">
              <SumRow label="🎯 Eredmény-tipped" value={pred ? `${pred.h}:${pred.a}` : 'nincs tipp'} bold={earned ? `${earned.pts} pt` : undefined} />
              <SumRow label="🪄 Wizard tipped" value={wiz?.pick ?? 'nincs'} bold={wiz?.oddsAtPick ? wiz.oddsAtPick.toFixed(2) : undefined} />
              <SumRow label="♟ Svájci" value="a kör párbajában számít" />
            </div>
          )}

          {tab === 'ev' && (
            mcLoading ? (
              <Loading />
            ) : mc && mc.events.length > 0 ? (
              <div className="space-y-1.5">
                {mc.events.map((e, i) => (
                  <div key={i} className="flex items-center text-[13px] font-bold">
                    {e.team === 'h' ? (
                      <span className="flex items-center gap-1.5 text-[#0D3331]">
                        <span>{EVENT_ICON[e.type] ?? '•'}</span>
                        <span>{e.player}</span>
                        {EVENT_SUFFIX[e.type] && <span className="text-[#0D3331]/50">{EVENT_SUFFIX[e.type]}</span>}
                        <span className="tnum text-[#0D3331]/45">{e.minute}'</span>
                      </span>
                    ) : (
                      <span className="ml-auto flex items-center gap-1.5 text-right text-[#0D3331]">
                        <span className="tnum text-[#0D3331]/45">{e.minute}'</span>
                        {EVENT_SUFFIX[e.type] && <span className="text-[#0D3331]/50">{EVENT_SUFFIX[e.type]}</span>}
                        <span>{e.player}</span>
                        <span>{EVENT_ICON[e.type] ?? '•'}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Még nincs élő esemény</Empty>
            )
          )}

          {tab === 'lu' && (
            mcLoading ? (
              <Loading />
            ) : mc?.lineups && (mc.lineups.home.length > 0 || mc.lineups.away.length > 0) ? (
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <LineupCol team={home} players={mc.lineups.home} />
                <LineupCol team={away} players={mc.lineups.away} align="right" />
              </div>
            ) : (
              <Empty>Még nincs felállás</Empty>
            )
          )}

          {tab === 'odds' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['1 · hazai', 'X · döntetlen', '2 · vendég'] as const).map((label, i) => (
                  <div key={label} className="rounded-[12px] bg-[#EBF6F5] px-1 py-[14px] text-center">
                    <div className="text-[11px] font-black text-[#0D3331]/50">{label}</div>
                    <div className="tnum mt-[3px] text-[18px] font-black text-[#007E73]">{odds ? odds[i].toFixed(2) : '—'}</div>
                  </div>
                ))}
              </div>
              <div className="mt-[11px] text-[11px] font-semibold text-[#0D3331]/55">
                🪄 Wizardban ennyit ér a helyes 1/X/2 · leadáskori odds · [1,1–10] sáv
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#F4F7F7] py-[9px] last:border-b-0">
      <span className="text-[13px] font-bold text-[#0D3331]/70">{label}</span>
      <span className="text-[13px] font-extrabold">
        {value}
        {bold && <b className="ml-2 text-[#007E73]">{bold}</b>}
      </span>
    </div>
  )
}

function Loading() {
  return <div className="py-6 text-center text-[12px] font-semibold text-[#0D3331]/45">Betöltés…</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-[12px] font-semibold text-[#0D3331]/45">{children}</div>
}

function LineupCol({ team, players, align }: { team: string; players: LineupPlayer[]; align?: 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="mb-1.5 text-[12px] font-extrabold text-[#0D3331]">
        {align === 'right' ? `${team} ${flag(team)}` : `${flag(team)} ${team}`}
      </div>
      {players.length === 0 ? (
        <div className="text-[#0D3331]/40">–</div>
      ) : (
        players.map((p, i) => (
          <div key={i} className="py-[2px] font-semibold leading-snug text-[#0D3331]/80">
            {align === 'right' ? (
              <>
                {p.name} <span className="tnum text-[#0D3331]/40">{p.num}</span>
              </>
            ) : (
              <>
                <span className="tnum text-[#0D3331]/40">{p.num}</span> {p.name}
              </>
            )}
          </div>
        ))
      )}
    </div>
  )
}

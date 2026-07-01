'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { flag, stadiumOf, type Fixture } from '@/lib/fixtures'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { myPrediction, myWizard, oddsFor, resultFor, teamsOf, wizardGainFor } from '@/lib/derive'

type MatchEvent = { minute: string; type: string; player: string; sub?: string; team: 'h' | 'a' }
type LineupPlayer = { num: string; name: string }
type MatchCentre = {
  events: MatchEvent[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] } | null
  odds: { h: number; x: number; a: number } | null
  status: string
  venue: string | null
  htScore: { h: number; a: number } | null
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
const EVENT_SUFFIX: Record<string, string> = {
  goal_penalty: ' (11m)',
  own_goal: ' (ög)',
  missed_penalty: ' (11m)'
}

const MONTHS = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.'
]

function formatKickoff(dateStr: string): string {
  const d = new Date(dateStr)
  if (!Number.isFinite(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}. ${hh}:${mm}`
}

export function MatchModal({
  fixture,
  live,
  onClose
}: {
  fixture: Fixture
  live: boolean
  onClose: () => void
}) {
  const { state, session } = useGame()
  const me = session?.player ?? ''
  const [tab, setTab] = useState<'sum' | 'ev' | 'lu' | 'odds'>('sum')
  const [mc, setMc] = useState<MatchCentre | null>(null)
  const [mcLoading, setMcLoading] = useState(true)

  // Fetch live match-centre data (events + lineups + odds) once, when the modal opens.
  useEffect(() => {
    let alive = true
    setMcLoading(true)
    fetch(`/api/match/${fixture.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return
        setMc({
          events: json.events ?? [],
          lineups: json.lineups ?? null,
          odds: json.odds ?? null,
          status: json.status ?? '',
          venue: json.venue ?? null,
          htScore: json.htScore ?? null
        })
      })
      .catch(() => {
        if (alive) setMc({ events: [], lineups: null, odds: null, status: '', venue: null, htScore: null })
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
  const wizardGain = me ? wizardGainFor(state, me, fixture.id) : null
  const odds = oddsFor(state, fixture.id)
  const earned = me ? state?.scores?.[encodeClientKey(me)]?.byMatch?.[String(fixture.id)] : undefined
  const { home, away } = teamsOf(state, fixture)

  // Effective odds: prefer modal's odds (includes kickoffOdds fallback) over state odds.
  const effectiveOdds = mc?.odds ?? (odds ? { h: odds[0], x: odds[1], a: odds[2] } : null)

  // Status badge text
  const statusBadge = mc?.status ? mc.status.toUpperCase() : live ? 'ÉLŐ' : result ? 'VÉGE' : ''

  // Venue display: modal fetch result → fixture STADIUMS map → raw venue field
  const venueDisplay = mc?.venue || stadiumOf(fixture.venue) || fixture.venue || ''

  if (typeof document === 'undefined') return null

  // Portal to <body> so the modal is NOT a DOM child of the clickable match card —
  // otherwise backdrop clicks bubble back to the card's open handler (the strobe bug).
  return createPortal(
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
          style={{
            background: live
              ? 'linear-gradient(160deg,#0C4D49,#0F6A64)'
              : 'linear-gradient(160deg,#073B43,#0B5560)'
          }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex size-[30px] items-center justify-center rounded-full bg-white/[0.16] text-[15px]"
          >
            ✕
          </button>
          <div className="text-[11px] font-extrabold tracking-[0.06em]" style={{ color: '#9fe6dd' }}>
            {fixture.group && fixture.group !== '–'
              ? `${fixture.group.toUpperCase()} CSOPORT`
              : (fixture.label ?? 'MECCS')}
            {statusBadge ? ` · ${statusBadge}` : ''}
          </div>
          <div className="my-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div className="text-center">
              <div className="text-[32px]">{flag(home)}</div>
              <div className="text-[13px] font-bold">{home}</div>
            </div>
            <div className="text-center">
              <div className="tnum text-[34px] font-black">
                {result?.h ?? '–'}
                <span className="mx-1.5 opacity-50">:</span>
                {result?.a ?? '–'}
              </div>
              {mc?.htScore && (
                <div className="tnum text-[11px] font-bold opacity-60">
                  ({mc.htScore.h}:{mc.htScore.a})
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-[32px]">{flag(away)}</div>
              <div className="text-[13px] font-bold">{away}</div>
            </div>
          </div>
          {venueDisplay && (
            <div className="mt-1 text-center text-[10px] font-semibold opacity-60">📍 {venueDisplay}</div>
          )}
        </div>

        <div className="flex gap-1.5 border-b border-[#EBF6F5] px-4 py-3">
          {(
            [
              ['sum', 'Összefoglaló'],
              ['ev', 'Események'],
              ['lu', 'Felállás'],
              ['odds', 'Odds']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`tap flex-1 rounded-[10px] px-1 py-[9px] text-[12px] font-extrabold ${
                tab === id ? 'bg-[#EBF6F5] text-[#007E73]' : 'text-[#0D3331]/55 hover:bg-[#F4F7F7]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-7 pt-3">
          {tab === 'sum' && (
            <div className="space-y-2">
              <SumRow
                label="🎯 Eredmény-tipped"
                value={pred ? `${pred.h}:${pred.a}` : 'nincs tipp'}
                bold={earned ? `${earned.pts} pt` : undefined}
              />
              <SumRow
                label="🪄 Wizard tipped"
                value={wiz?.pick ?? 'nincs'}
                bold={
                  wizardGain != null
                    ? result
                      ? `+${wizardGain.toFixed(2)}`
                      : wizardGain.toFixed(2)
                    : undefined
                }
              />
              <SumRow label="♟ Svájci" value="a kör párbajában számít" />
              <SumRow label="🕘 Kezdés" value={formatKickoff(fixture.date)} />
              {venueDisplay && <SumRow label="📍 Helyszín" value={venueDisplay} />}
            </div>
          )}

          {tab === 'ev' &&
            (mcLoading ? (
              <Loading />
            ) : mc && mc.events.length > 0 ? (
              <EventsList events={mc.events} htScore={mc.htScore} />
            ) : (
              <Empty>Még nincs élő esemény</Empty>
            ))}

          {tab === 'lu' &&
            (mcLoading ? (
              <Loading />
            ) : mc?.lineups && (mc.lineups.home.length > 0 || mc.lineups.away.length > 0) ? (
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <LineupCol team={home} players={mc.lineups.home} />
                <LineupCol team={away} players={mc.lineups.away} align="right" />
              </div>
            ) : (
              <Empty>Még nincs felállás</Empty>
            ))}

          {tab === 'odds' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['1 · hazai', 'X · döntetlen', '2 · vendég'] as const).map((label, i) => {
                  const val = effectiveOdds ? [effectiveOdds.h, effectiveOdds.x, effectiveOdds.a][i] : null
                  return (
                    <div key={label} className="rounded-[12px] bg-[#EBF6F5] px-1 py-[14px] text-center">
                      <div className="text-[11px] font-black text-[#0D3331]/50">{label}</div>
                      <div className="tnum mt-[3px] text-[18px] font-black text-[#007E73]">
                        {val ? val.toFixed(2) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-[11px] text-[11px] font-semibold text-[#0D3331]/55">
                🪄 Wizardban ennyit ér a helyes 1/X/2 · leadáskori odds · [1,1–10] sáv
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Renders the events list with HT separator and substitution partner.
function EventsList({ events, htScore }: { events: MatchEvent[]; htScore: { h: number; a: number } | null }) {
  // Split events into first and second half by minute number.
  const firstHalf: MatchEvent[] = []
  const secondHalf: MatchEvent[] = []
  for (const e of events) {
    const min = parseInt(e.minute, 10)
    // Minutes > 45 (including 45+N) go to second half. Non-numeric → second half by default.
    if (!Number.isNaN(min) && min <= 45) firstHalf.push(e)
    else secondHalf.push(e)
  }

  return (
    <div className="space-y-1.5">
      {firstHalf.map((e, i) => (
        <EventRow key={`h1-${i}`} event={e} />
      ))}
      {/* Half-time separator — always shown when there are two halves or htScore is known */}
      {(firstHalf.length > 0 || secondHalf.length > 0) && (
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-[#EBF6F5]" />
          <span className="text-[11px] font-extrabold text-[#0D3331]/40">
            {htScore ? `Félidő ${htScore.h}–${htScore.a}` : 'Félidő'}
          </span>
          <div className="h-px flex-1 bg-[#EBF6F5]" />
        </div>
      )}
      {secondHalf.map((e, i) => (
        <EventRow key={`h2-${i}`} event={e} />
      ))}
    </div>
  )
}

function EventRow({ event: e }: { event: MatchEvent }) {
  const isSub = e.type === 'sub'
  return (
    <div className="flex items-center text-[13px] font-bold">
      {e.team === 'h' ? (
        <span className="flex flex-col gap-0">
          <span className="flex items-center gap-1.5 text-[#0D3331]">
            <span>{EVENT_ICON[e.type] ?? '•'}</span>
            <span>{e.player}</span>
            {EVENT_SUFFIX[e.type] && <span className="text-[#0D3331]/50">{EVENT_SUFFIX[e.type]}</span>}
            <span className="tnum text-[#0D3331]/45">{e.minute}'</span>
          </span>
          {isSub && e.sub && (
            <span className="ml-6 text-[11px] font-semibold text-[#0D3331]/45">⬇ {e.sub}</span>
          )}
        </span>
      ) : (
        <span className="ml-auto flex flex-col items-end gap-0">
          <span className="flex items-center gap-1.5 text-right text-[#0D3331]">
            <span className="tnum text-[#0D3331]/45">{e.minute}'</span>
            {EVENT_SUFFIX[e.type] && <span className="text-[#0D3331]/50">{EVENT_SUFFIX[e.type]}</span>}
            <span>{e.player}</span>
            <span>{EVENT_ICON[e.type] ?? '•'}</span>
          </span>
          {isSub && e.sub && (
            <span className="mr-6 text-[11px] font-semibold text-[#0D3331]/45">{e.sub} ⬇</span>
          )}
        </span>
      )}
    </div>
  )
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#F4F7F7] py-[9px] last:border-b-0">
      <span className="text-[13px] font-bold text-[#0D3331]/70">{label}</span>
      <span className="text-right text-[13px] font-extrabold">
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

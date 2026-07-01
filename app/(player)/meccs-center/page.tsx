'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { LiveCard, FinishedCard } from '@/components/broadcast-card'
import { MatchModal } from '@/components/match-modal'
import { useGame } from '@/components/game-provider'
import { flag, stadiumOf, MATCHES, type Fixture } from '@/lib/fixtures'
import { countdown, kickoffMs, liveScoreFor, oddsFor, resultFor, statusOf, teamsOf } from '@/lib/derive'

const CARD_EVENT_TYPES = new Set(['goal', 'goal_penalty', 'own_goal', 'yellow', 'red', 'yellow_red'])
const FINISHED_PAGE_SIZE = 20
const CARD_ICON: Record<string, string> = {
  goal: '⚽',
  goal_penalty: '⚽',
  own_goal: '⚽',
  yellow: '🟨',
  red: '🟥',
  yellow_red: '🟨🟥'
}
const CARD_SUFFIX: Record<string, string> = { goal_penalty: '(11m)', own_goal: '(ög)' }

type CardEvent = { minute: string; type: string; player: string; team: 'h' | 'a' }

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
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
function kickoffLabel(f: Fixture): string {
  const d = new Date(f.date)
  if (!Number.isFinite(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}. ${hh}:${mm}`
}

function badgeOf(f: Fixture): string {
  if (f.stage === 'group' && f.group && f.group !== '–') return `${f.group} csoport`
  if (f.stage === 'test') return 'Felkészülési'
  return f.label ?? 'Meccs'
}

export default function MeccsCenterPage() {
  const { state, status } = useGame()
  const [finishedLimit, setFinishedLimit] = useState(FINISHED_PAGE_SIZE)

  const buckets = useMemo(() => {
    const now = Date.now()
    const todayStart = startOfDay(now)
    const tomorrowStart = todayStart + 24 * 3_600_000
    const live: Fixture[] = []
    const finished: Fixture[] = []
    const today: Fixture[] = []
    const upcoming: Fixture[] = []
    for (const f of MATCHES) {
      const s = statusOf(state, f, now)
      if (s === 'live') {
        live.push(f)
      } else if (s === 'finished') {
        finished.push(f)
      } else {
        const ko = kickoffMs(f)
        if (ko >= tomorrowStart) upcoming.push(f)
        else today.push(f) // today + any past-but-unresolved fixtures
      }
    }
    const byKo = (a: Fixture, b: Fixture) => kickoffMs(a) - kickoffMs(b)
    return {
      live: live.sort(byKo),
      finished: finished.sort(byKo).reverse(),
      today: today.sort(byKo),
      upcoming: upcoming.sort(byKo)
    }
  }, [state])

  const empty =
    status === 'ready' &&
    !buckets.live.length &&
    !buckets.finished.length &&
    !buckets.today.length &&
    !buckets.upcoming.length
  const visibleFinished = buckets.finished.slice(0, finishedLimit)
  const hiddenFinished = Math.max(0, buckets.finished.length - visibleFinished.length)

  return (
    <>
      <PageHeader eyebrow="MATCH CENTRE" title="Meccs Center" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        {status === 'loading' && <Skeleton />}

        {/* 🔴 ÉLŐBEN */}
        {buckets.live.length > 0 && (
          <Section>
            <Header>
              <span className="live-dot size-[9px] rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]" />
              ÉLŐBEN
            </Header>
            {buckets.live.map((f) => (
              <LiveCard key={f.id} fixture={f} />
            ))}
          </Section>
        )}

        {/* 📅 MAI MECCSEK */}
        {buckets.today.length > 0 && (
          <Section>
            <Header>📅 MAI MECCSEK</Header>
            <div className="grid gap-2 sm:grid-cols-2">
              {buckets.today.map((f) => (
                <UpcomingCard key={f.id} fixture={f} />
              ))}
            </div>
          </Section>
        )}

        {/* 🏁 LEGFRISSEBB EREDMÉNYEK — full-width hero for the newest, 2-col for the rest */}
        {visibleFinished.length > 0 && (
          <Section>
            <Header>🏁 LEGFRISSEBB EREDMÉNYEK</Header>
            <FinishedCard fixture={visibleFinished[0]} />
            {visibleFinished.length > 1 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleFinished.slice(1).map((f) => (
                  <UpcomingCard key={f.id} fixture={f} />
                ))}
              </div>
            )}
            {hiddenFinished > 0 && (
              <button
                type="button"
                onClick={() => setFinishedLimit((value) => value + FINISHED_PAGE_SIZE)}
                className="tap mt-3 w-full rounded-[14px] border border-[#DCEFEE] bg-white px-4 py-[11px] text-[13px] font-black text-[#007E73] hover:border-[#9fd8d2]"
              >
                Korábbi eredmények +{Math.min(FINISHED_PAGE_SIZE, hiddenFinished)}
              </button>
            )}
          </Section>
        )}

        {/* ⏳ KÖZELGŐ — compact 3-col grid */}
        {buckets.upcoming.length > 0 && (
          <Section>
            <Header>⏳ KÖZELGŐ</Header>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {buckets.upcoming.map((f) => (
                <UpcomingCard key={f.id} fixture={f} />
              ))}
            </div>
          </Section>
        )}

        {empty && (
          <div className="py-12 text-center text-[14px] text-[#0D3331]/50">
            Nincs megjeleníthető mérkőzés.
          </div>
        )}
      </div>
    </>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mb-5">{children}</section>
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[10px] flex items-center gap-[7px] text-xs font-black tracking-[0.06em] text-[#0D3331]/55">
      {children}
    </div>
  )
}

// Tap-to-open compact card for not-yet-started fixtures (today + upcoming).
function UpcomingCard({ fixture }: { fixture: Fixture }) {
  const { state } = useGame()
  const [open, setOpen] = useState(false)
  const { home, away } = teamsOf(state, fixture)
  const result = resultFor(state, fixture.id)
  const live = liveScoreFor(state, fixture.id)
  const odds = oddsFor(state, fixture.id)
  const cd = countdown(fixture)
  const events = (state?.matchEvents?.[String(fixture.id)] ?? []).filter((e) =>
    CARD_EVENT_TYPES.has(e.type)
  ) as CardEvent[]
  const htScore = state?.matchScores?.[String(fixture.id)]?.ht ?? null

  return (
    <div
      onClick={() => setOpen(true)}
      className="tap cursor-pointer overflow-hidden rounded-[16px] bg-white surface-card hover:bg-[#F7FBFA]"
    >
      {open && <MatchModal fixture={fixture} live={false} onClose={() => setOpen(false)} />}
      <div className="flex items-center justify-between border-b border-[#EBF6F5] bg-[#f6faf9] px-[13px] py-[7px] text-[10px] font-extrabold tracking-[0.04em] text-[#0D3331]/55">
        <span>{badgeOf(fixture)}</span>
        <span className="tnum">{kickoffLabel(fixture)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-[12px]">
        <div className="flex min-w-0 items-center gap-[6px]">
          <span className="text-[18px]">{flag(home)}</span>
          <span className="truncate text-[13px] font-extrabold">{home}</span>
        </div>
        <div className="tnum text-center text-[16px] font-black text-[#0D3331]/40">
          {result ? `${result.h}:${result.a}` : live ? `${live.h}:${live.a}` : 'VS'}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-[6px]">
          <span className="truncate text-right text-[13px] font-extrabold">{away}</span>
          <span className="text-[18px]">{flag(away)}</span>
        </div>
      </div>
      {events.length > 0 && <CompactEvents events={events} htScore={htScore} />}
      {odds ? (
        <div className="flex items-center justify-around border-t border-[#EBF6F5] bg-[#fbfdfd] px-3 py-[7px] text-[11px] font-bold text-[#0D3331]/60">
          <span>
            1 <b className="tnum text-[#007E73]">{odds[0].toFixed(2)}</b>
          </span>
          <span>
            X <b className="tnum text-[#007E73]">{odds[1].toFixed(2)}</b>
          </span>
          <span>
            2 <b className="tnum text-[#007E73]">{odds[2].toFixed(2)}</b>
          </span>
        </div>
      ) : (
        cd && (
          <div className="border-t border-[#EBF6F5] px-3 py-[6px] text-center text-[11px] font-bold text-[#007E73]">
            ⏰ {cd}
          </div>
        )
      )}
      {fixture.venue && (
        <div className="border-t border-[#EBF6F5] px-3 py-[5px] text-center text-[10px] font-semibold text-[#0D3331]/40">
          📍 {stadiumOf(fixture.venue)}
        </div>
      )}
    </div>
  )
}

function CompactEvents({
  events,
  htScore
}: {
  events: CardEvent[]
  htScore: { h: number; a: number } | null
}) {
  const firstHalf = events.filter((e) => {
    const min = parseInt(e.minute, 10)
    return !Number.isNaN(min) && min <= 45
  })
  const secondHalf = events.filter((e) => {
    const min = parseInt(e.minute, 10)
    return Number.isNaN(min) || min > 45
  })

  const row = (e: CardEvent, i: number) => (
    <div key={i} className="flex items-start text-[10px] font-bold leading-tight text-[#0D3331]/65">
      {e.team === 'h' ? (
        <span className="flex min-w-0 items-center gap-[3px]">
          <span>{CARD_ICON[e.type]}</span>
          <span className="tnum text-[#0D3331]/38">{e.minute}'</span>
          <span className="truncate">{e.player}</span>
          {CARD_SUFFIX[e.type] && <span className="text-[#0D3331]/35">{CARD_SUFFIX[e.type]}</span>}
        </span>
      ) : (
        <span className="ml-auto flex min-w-0 items-center gap-[3px] text-right">
          {CARD_SUFFIX[e.type] && <span className="text-[#0D3331]/35">{CARD_SUFFIX[e.type]}</span>}
          <span className="truncate">{e.player}</span>
          <span className="tnum text-[#0D3331]/38">{e.minute}'</span>
          <span>{CARD_ICON[e.type]}</span>
        </span>
      )}
    </div>
  )

  return (
    <div className="border-t border-[#EBF6F5] px-3 py-2">
      {firstHalf.map(row)}
      {firstHalf.length > 0 && secondHalf.length > 0 && (
        <div className="flex items-center gap-1 py-[2px]">
          <div className="h-px flex-1 bg-[#DCEFEE]" />
          <span className="text-[9px] font-extrabold text-[#0D3331]/35">
            {htScore ? `${htScore.h}–${htScore.a}` : 'FI'}
          </span>
          <div className="h-px flex-1 bg-[#DCEFEE]" />
        </div>
      )}
      {secondHalf.map(row)}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[58px] animate-pulse rounded-[18px] bg-white/70" />
      ))}
    </div>
  )
}

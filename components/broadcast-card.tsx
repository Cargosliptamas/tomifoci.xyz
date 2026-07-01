'use client'

import { useState } from 'react'
import { useGame } from '@/components/game-provider'
import { MatchModal } from '@/components/match-modal'
import { flag, type Fixture } from '@/lib/fixtures'
import { encodeClientKey } from '@/lib/keys'
import { liveScoreFor, myPrediction, myWizard, resultFor, teamsOf, wizardGainFor } from '@/lib/derive'

// Event types shown inline on cards (no subs — too verbose for compact cards).
const CARD_EVENT_TYPES = new Set(['goal', 'goal_penalty', 'own_goal', 'yellow', 'red', 'yellow_red'])
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

function useMatchView(fixture: Fixture) {
  const { state, session } = useGame()
  const me = session?.player ?? ''
  const result = resultFor(state, fixture.id)
  const live = liveScoreFor(state, fixture.id)
  const pred = me ? myPrediction(state, me, fixture.id) : null
  const wiz = me ? myWizard(state, me, fixture.id) : null
  const wizardGain = me ? wizardGainFor(state, me, fixture.id) : null
  const byMatch = me ? state?.scores?.[encodeClientKey(me)]?.byMatch?.[String(fixture.id)] : undefined
  // Events + HT score from polled cache
  const events = (state?.matchEvents?.[String(fixture.id)] ?? []).filter((e) =>
    CARD_EVENT_TYPES.has(e.type)
  ) as CardEvent[]
  const htScore = state?.matchScores?.[String(fixture.id)]?.ht ?? null
  return { result, live, pred, wiz, wizardGain, earned: byMatch, events, htScore }
}

export function LiveCard({ fixture }: { fixture: Fixture }) {
  const { result, live, pred, wiz, wizardGain, earned, events, htScore } = useMatchView(fixture)
  const [open, setOpen] = useState(false)
  // Show FT result if it exists, else the live in-progress score, else –:–.
  const h = result?.h ?? live?.h
  const a = result?.a ?? live?.a
  const elapsed = !result && live?.elapsed ? live.elapsed : ''
  return (
    <div
      onClick={() => setOpen(true)}
      className="broadcast-dark tap mb-2 cursor-pointer rounded-[18px] p-4 shadow-[0_12px_30px_rgba(12,77,73,0.3)] hover:brightness-[1.05]"
    >
      {open && <MatchModal fixture={fixture} live onClose={() => setOpen(false)} />}
      <div
        className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.06em]"
        style={{ color: '#9fe6dd' }}
      >
        <span>
          {fixture.group && fixture.group !== '–' ? fixture.group.toUpperCase() : (fixture.label ?? 'MECCS')}
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <span className="live-dot size-[7px] rounded-full bg-[#FF3B30]" /> ÉLŐ{elapsed ? ` ${elapsed}` : ''}
        </span>
      </div>
      <Score fixture={fixture} h={h} a={a} />
      {events.length > 0 && <InlineEvents events={events} htScore={htScore} />}
      <div className="flex gap-1.5">
        <Chip
          text={`🎯 ${pred ? `${pred.h}:${pred.a}` : 'nincs'}`}
          bold={earned ? `${earned.pts}pt` : undefined}
        />
        <Chip text={`🪄 ${wiz?.pick ?? '—'}`} bold={wizardGain != null ? wizardGain.toFixed(2) : undefined} />
        <Chip text="♟ él" />
      </div>
    </div>
  )
}

export function FinishedCard({ fixture }: { fixture: Fixture }) {
  const { result, pred, wiz, wizardGain, earned, events, htScore } = useMatchView(fixture)
  const total = earned ? earned.pts : 0
  const [open, setOpen] = useState(false)
  return (
    <div
      onClick={() => setOpen(true)}
      className="broadcast-finished tap mb-3 cursor-pointer rounded-[18px] px-4 py-[14px] hover:brightness-[1.05]"
    >
      {open && <MatchModal fixture={fixture} live={false} onClose={() => setOpen(false)} />}
      <div
        className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.06em]"
        style={{ color: '#9fe6dd' }}
      >
        <span>
          {fixture.group && fixture.group !== '–' ? fixture.group.toUpperCase() : (fixture.label ?? 'VÉGE')} ·
          VÉGE
        </span>
        {pred && <span>összesen +{total}</span>}
      </div>
      <Score fixture={fixture} h={result?.h} a={result?.a} small />
      {events.length > 0 && <InlineEvents events={events} htScore={htScore} />}
      <div className="flex gap-1.5">
        <Chip
          text={`🎯 ${pred ? `${pred.h}:${pred.a}` : 'nincs'}`}
          bold={pred ? `+${earned?.pts ?? 0}` : undefined}
        />
        <Chip
          text={`🪄 ${wiz?.pick ?? '—'}`}
          bold={wizardGain != null ? `+${wizardGain.toFixed(2)}` : undefined}
        />
        <Chip text="♟ párbaj" />
      </div>
    </div>
  )
}

// Compact inline event list for cards — goals and cards only, two columns (home left / away right).
function InlineEvents({
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

  const renderEvent = (e: CardEvent, i: number) => (
    <div key={i} className="flex items-start text-[10px] font-bold leading-tight">
      {e.team === 'h' ? (
        <span className="flex items-center gap-[3px] text-white/80">
          <span>{CARD_ICON[e.type]}</span>
          <span className="tnum text-white/50">{e.minute}'</span>
          <span className="truncate">{e.player}</span>
          {CARD_SUFFIX[e.type] && <span className="text-white/40">{CARD_SUFFIX[e.type]}</span>}
        </span>
      ) : (
        <span className="ml-auto flex items-center gap-[3px] text-right text-white/80">
          {CARD_SUFFIX[e.type] && <span className="text-white/40">{CARD_SUFFIX[e.type]}</span>}
          <span className="truncate">{e.player}</span>
          <span className="tnum text-white/50">{e.minute}'</span>
          <span>{CARD_ICON[e.type]}</span>
        </span>
      )}
    </div>
  )

  return (
    <div className="mb-3 space-y-[2px]">
      {firstHalf.map(renderEvent)}
      {firstHalf.length > 0 && secondHalf.length > 0 && (
        <div className="flex items-center gap-1 py-[2px]">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-[9px] font-extrabold text-white/35">
            {htScore ? `${htScore.h}–${htScore.a}` : 'FI'}
          </span>
          <div className="h-px flex-1 bg-white/15" />
        </div>
      )}
      {secondHalf.map(renderEvent)}
    </div>
  )
}

function Score({ fixture, h, a, small }: { fixture: Fixture; h?: number; a?: number; small?: boolean }) {
  const { state } = useGame()
  const { home, away } = teamsOf(state, fixture)
  return (
    <div className="my-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-white">
      <div className="text-center">
        <div className={small ? 'text-[26px]' : 'text-[30px]'}>{flag(home)}</div>
        <div className="text-[13px] font-bold">{home}</div>
      </div>
      <div className={`tnum ${small ? 'text-[30px]' : 'text-[40px]'} font-black`}>
        {h ?? '–'}
        <span className="mx-1.5 opacity-50">:</span>
        {a ?? '–'}
      </div>
      <div className="text-center">
        <div className={small ? 'text-[26px]' : 'text-[30px]'}>{flag(away)}</div>
        <div className="text-[13px] font-bold">{away}</div>
      </div>
    </div>
  )
}

function Chip({ text, bold }: { text: string; bold?: string }) {
  return (
    <span className="flex-1 rounded-[9px] bg-white/10 px-1 py-[7px] text-center text-[11px] font-extrabold text-white">
      {text}
      {bold && (
        <>
          {' → '}
          <b style={{ color: '#FFD700' }}>{bold}</b>
        </>
      )}
    </span>
  )
}

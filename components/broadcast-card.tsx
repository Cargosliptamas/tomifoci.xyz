'use client'

import { useState } from 'react'
import { useGame } from '@/components/game-provider'
import { MatchModal } from '@/components/match-modal'
import { flag, type Fixture } from '@/lib/fixtures'
import { encodeClientKey } from '@/lib/keys'
import { liveScoreFor, myPrediction, myWizard, resultFor, teamsOf } from '@/lib/derive'

function useMatchView(fixture: Fixture) {
  const { state, session } = useGame()
  const me = session?.player ?? ''
  const result = resultFor(state, fixture.id)
  const live = liveScoreFor(state, fixture.id)
  const pred = me ? myPrediction(state, me, fixture.id) : null
  const wiz = me ? myWizard(state, me, fixture.id) : null
  const byMatch = me ? state?.scores?.[encodeClientKey(me)]?.byMatch?.[String(fixture.id)] : undefined
  return { result, live, pred, wiz, earned: byMatch }
}

export function LiveCard({ fixture }: { fixture: Fixture }) {
  const { result, live, pred, wiz, earned } = useMatchView(fixture)
  const [open, setOpen] = useState(false)
  // Show FT result if it exists, else the live in-progress score, else –:–.
  const h = result?.h ?? live?.h
  const a = result?.a ?? live?.a
  const elapsed = !result && live?.elapsed ? live.elapsed : ''
  return (
    <div onClick={() => setOpen(true)} className="broadcast-dark tap mb-2 cursor-pointer rounded-[18px] p-4 shadow-[0_12px_30px_rgba(12,77,73,0.3)] hover:brightness-[1.05]">
      {open && <MatchModal fixture={fixture} live onClose={() => setOpen(false)} />}
      <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.06em]" style={{ color: '#9fe6dd' }}>
        <span>{fixture.group && fixture.group !== '–' ? fixture.group.toUpperCase() : (fixture.label ?? 'MECCS')}</span>
        <span className="inline-flex items-center gap-[5px]">
          <span className="live-dot size-[7px] rounded-full bg-[#FF3B30]" /> ÉLŐ{elapsed ? ` ${elapsed}` : ''}
        </span>
      </div>
      <Score fixture={fixture} h={h} a={a} />
      <div className="flex gap-1.5">
        <Chip text={`🎯 ${pred ? `${pred.h}:${pred.a}` : 'nincs'}`} bold={earned ? `${earned.pts}pt` : undefined} />
        <Chip text={`🪄 ${wiz?.pick ?? '—'}`} bold={wiz?.oddsAtPick ? wiz.oddsAtPick.toFixed(2) : undefined} />
        <Chip text="♟ él" />
      </div>
    </div>
  )
}

export function FinishedCard({ fixture }: { fixture: Fixture }) {
  const { result, pred, wiz, earned } = useMatchView(fixture)
  const total = earned ? earned.pts : 0
  const [open, setOpen] = useState(false)
  return (
    <div onClick={() => setOpen(true)} className="broadcast-finished tap mb-3 cursor-pointer rounded-[18px] px-4 py-[14px] hover:brightness-[1.05]">
      {open && <MatchModal fixture={fixture} live={false} onClose={() => setOpen(false)} />}
      <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.06em]" style={{ color: '#9fe6dd' }}>
        <span>{fixture.group && fixture.group !== '–' ? fixture.group.toUpperCase() : (fixture.label ?? 'VÉGE')} · VÉGE</span>
        {pred && <span>összesen +{total}</span>}
      </div>
      <Score fixture={fixture} h={result?.h} a={result?.a} small />
      <div className="flex gap-1.5">
        <Chip text={`🎯 ${pred ? `${pred.h}:${pred.a}` : 'nincs'}`} bold={pred ? `+${earned?.pts ?? 0}` : undefined} />
        <Chip text={`🪄 ${wiz?.pick ?? '—'}`} bold={wiz?.oddsAtPick ? `+${wiz.oddsAtPick.toFixed(2)}` : undefined} />
        <Chip text="♟ párbaj" />
      </div>
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

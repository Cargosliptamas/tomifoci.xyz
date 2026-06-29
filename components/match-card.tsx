'use client'

import { useState } from 'react'
import { useGame } from '@/components/game-provider'
import { flag, type Fixture } from '@/lib/fixtures'
import {
  countdown,
  isFavoriteMatch,
  myPrediction,
  myWizard,
  oddsFor,
  statusOf,
  teamsOf
} from '@/lib/derive'

export function MatchCard({ fixture }: { fixture: Fixture }) {
  const { state, session, savePrediction } = useGame()
  const me = session?.player ?? ''

  const [expanded, setExpanded] = useState(false)
  const status = statusOf(state, fixture)
  const locked = status === 'locked'
  const fav = me ? isFavoriteMatch(state, me, fixture) : false
  const { home, away } = teamsOf(state, fixture)

  const savedPred = me ? myPrediction(state, me, fixture.id) : null
  const savedWiz = me ? myWizard(state, me, fixture.id) : null
  const odds = oddsFor(state, fixture.id)

  const [h, setH] = useState(savedPred?.h ?? 0)
  const [a, setA] = useState(savedPred?.a ?? 0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(Boolean(savedPred))
  const [err, setErr] = useState<string | null>(null)

  function step(side: 'h' | 'a', delta: number) {
    if (locked) return
    const set = side === 'h' ? setH : setA
    const cur = side === 'h' ? h : a
    set(Math.min(20, Math.max(0, cur + delta)))
    setDirty(true)
    setSavedMsg(false)
  }

  async function save() {
    if (locked || saving) return
    setSaving(true)
    setErr(null)
    const r1 = await savePrediction(fixture.id, h, a)
    setSaving(false)
    if (r1.ok) {
      setSavedMsg(true)
      setDirty(false)
    } else {
      setErr(errLabel(r1.error))
    }
  }

  const statusChip = chipFor(status, Boolean(savedPred), Boolean(savedWiz))

  return (
    <div className="mb-3 overflow-hidden rounded-[18px] bg-white surface-card">
      <button onClick={() => setExpanded((v) => !v)} className="tap flex w-full items-center gap-[10px] px-4 py-[14px] text-left hover:bg-[#F7FBFA]">
        <span
          className="w-[54px] flex-none text-[11px] font-extrabold"
          style={{ color: status === 'open' && countdown(fixture).includes('perc!') ? '#FF9500' : locked ? 'rgba(13,51,49,0.4)' : '#007E73' }}
        >
          {locked ? '🔒' : countdown(fixture)}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-[7px] text-[15px] font-extrabold text-[#0D3331]">
          <span>{flag(home)}</span>
          <span className="truncate">{home}</span>
          <span className="text-[#0D3331]/30">–</span>
          <span className="truncate">{away}</span>
          <span>{flag(away)}</span>
        </span>
        {fav && (
          <span className="rounded-full bg-[#fff3d6] px-[7px] py-[3px] text-[10px] font-black text-[#9a6b00]">⭐×2</span>
        )}
        <span className="rounded-full px-[9px] py-1 text-[11px] font-extrabold" style={statusChip.style}>
          {statusChip.label}
        </span>
        <span className="text-[18px] text-[#0D3331]/30" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ⌄
        </span>
      </button>

      {expanded && (
        <div className="animate-in px-4 pb-4 pt-1">
          {/* 🎯 EREDMÉNY-TIPP */}
          <div className="border-t border-[#EBF6F5] pt-[13px]">
            <div className="text-[11px] font-black tracking-[0.08em] text-[#007E73]">
              🎯 EREDMÉNY-TIPP <span className="font-bold text-[#0D3331]/40">· 5/3/2/1 pont · 90 perc</span>
            </div>
            {fav && (
              <div className="mb-[10px] mt-2 rounded-[9px] bg-[#fff3d6] px-[10px] py-[7px] text-[11px] font-bold text-[#9a6b00]">
                ⭐ Kedvenc csapatod — ezen a meccsen <b>dupla pont</b>, és továbbjutásért <b>+3 bónusz</b>.
              </div>
            )}
            {locked && (
              <div className="mb-[10px] mt-2 rounded-[9px] bg-[#EBF0F0] px-[10px] py-[7px] text-[11px] font-bold text-[#0D3331]/60">
                🔒 Lezárva a kezdő sípszókor — a mentett tipped látható.
              </div>
            )}
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="text-right text-[13px] font-bold">
                {home} {flag(home)}
              </span>
              <div className="flex items-center gap-2">
                <Stepper value={h} onStep={(d) => step('h', d)} disabled={locked} />
                <span className="text-[20px] font-black text-[#0D3331]/40">:</span>
                <Stepper value={a} onStep={(d) => step('a', d)} disabled={locked} />
              </div>
              <span className="text-left text-[13px] font-bold">
                {flag(away)} {away}
              </span>
            </div>
          </div>

          {/* 🪄 WIZARD odds (read-only here) — picking 1/X/2 happens on the Wizard tab */}
          <div className="mt-[14px] border-t border-[#EBF6F5] pt-[13px]">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-black tracking-[0.08em] text-[#007E73]">
                🪄 WIZARD ODDS <span className="font-bold text-[#0D3331]/40">· a tipped 1/X/2-re</span>
              </div>
              {savedWiz?.pick && (
                <span className="rounded-full bg-[#EBF6F5] px-2 py-0.5 text-[10px] font-extrabold text-[#007E73]">
                  tipped: {savedWiz.pick}
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['1', 'X', '2'] as const).map((p, i) => (
                <div
                  key={p}
                  className={`rounded-[12px] px-1 py-[9px] text-center ${savedWiz?.pick === p ? 'broadcast-info' : 'border border-[#DCEFEE] bg-white text-[#0D3331]'}`}
                >
                  <div className="text-[11px] font-black">{p}</div>
                  <div className="tnum mt-px text-[15px] font-black">{odds ? odds[i].toFixed(2) : '—'}</div>
                </div>
              ))}
            </div>
            <div className="mt-[9px] text-[11px] font-semibold text-[#0D3331]/55">
              A Wizard-tipp alapból a tippedből tükröződik. Felülírni a 🪄 Wizard fülön tudod.
            </div>
          </div>

          {/* ♟ SVÁJCI */}
          <div className="mt-[14px] flex gap-[9px] border-t border-[#EBF6F5] pt-[11px]">
            <span className="text-[11px] font-black tracking-[0.08em] text-[#007E73]">♟ SVÁJCI</span>
            <span className="flex-1 text-xs text-[#0D3331]/70">
              A kör 8 meccsének alappontja számít a párbajodban — a részletek a Tabellán.
            </span>
          </div>

          {err && <div className="mt-2 text-[12px] font-bold text-[#FF3B30]">{err}</div>}

          <button
            onClick={save}
            disabled={locked || saving}
            className="mt-[14px] w-full rounded-[13px] py-[13px] text-[14px] font-black"
            style={
              locked
                ? { background: '#EBF0F0', color: 'rgba(13,51,49,0.5)' }
                : savedMsg && !dirty
                  ? { background: '#e9f6ee', color: '#15803d' }
                  : { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37', boxShadow: '0 6px 16px rgba(0,184,169,0.28)' }
            }
          >
            {locked ? '🔒 Lezárva a sípszókor' : saving ? 'Mentés…' : savedMsg && !dirty ? '✓ Eredmény-tipp mentve' : 'Mentés — eredmény-tipp'}
          </button>
        </div>
      )}
    </div>
  )
}

function Stepper({ value, onStep, disabled }: { value: number; onStep: (d: number) => void; disabled: boolean }) {
  const btn = disabled
    ? 'h-[26px] w-[44px] rounded-[9px] border border-[#EBF0F0] bg-[#F4F7F7] text-[16px] font-extrabold text-[#0D3331]/30'
    : 'tap h-[26px] w-[44px] rounded-[9px] border border-[#DCEFEE] bg-white text-[16px] font-extrabold text-[#007E73] hover:bg-[#F7FBFA]'
  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => onStep(1)} disabled={disabled} className={btn}>
        +
      </button>
      <span className="tnum flex size-[44px] items-center justify-center rounded-[12px] bg-[#EBF6F5] text-[20px] font-black">
        {value}
      </span>
      <button onClick={() => onStep(-1)} disabled={disabled} className={btn}>
        −
      </button>
    </div>
  )
}

function chipFor(status: string, hasPred: boolean, hasWiz: boolean) {
  if (status === 'locked' || status === 'live' || status === 'finished') {
    if (status === 'live') return { label: '🔴 élő', style: { color: '#fff', background: '#FF3B30' } as const }
    if (status === 'finished') return { label: '✓ vége', style: { color: '#15803d', background: '#e9f6ee' } as const }
    return { label: '🔒 lezárva', style: { color: 'rgba(13,51,49,0.55)', background: '#EBF0F0' } as const }
  }
  if (hasPred || hasWiz) {
    const label = hasPred && hasWiz ? '🎯🪄 kész' : hasPred ? '🎯 tipp' : '🪄 wiz'
    return { label, style: { color: '#15803d', background: '#e9f6ee' } as const }
  }
  return { label: 'nincs tipp', style: { color: '#FF9500', background: '#fff4e6' } as const }
}

function errLabel(error?: string) {
  if (error === 'match-locked') return 'A meccs lezárult — a tipp már nem menthető.'
  if (error === 'bad-pin') return 'Hibás PIN — jelentkezz be újra.'
  if (error === 'auth-not-provisioned') return 'A PIN-ellenőrzés még nincs beállítva (Neon auth tábla).'
  return 'Mentés sikertelen.'
}

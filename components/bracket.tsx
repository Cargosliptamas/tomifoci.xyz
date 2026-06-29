'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useGame } from '@/components/game-provider'
import { flag } from '@/lib/fixtures'
import { encodeClientKey } from '@/lib/keys'
import type { GameState, SwissStanding } from '@/lib/types'

// ---------------------------------------------------------------------------
// Converging "March Madness" knockout bracket (ágrajz) — LIVE DATA.
// Geometry ported faithfully from the design handoff
// (design_handoff_vbtippjatek_redesign/Tomifoci 2026 - Brackets.dc.html).
// Two sides converge on a center final: left fills L->R, right mirrored R->L.
//
// WC variant  — fed from state.koTeams (real teams per KO slot 73-104) and
//               state.results (scores). R32 = slots 73-88, R16 = 89-96,
//               QF = 97-100, SF = 101-102, final = 104.
// Párbaj variant — seeded from state.swiss.standings (top-32 playoff seeding).
//               No playoff result feed exists yet, so only the seeding round
//               is populated; later rounds show "—". Empty standings → notice.
// ---------------------------------------------------------------------------

type Win = 't' | 'b' | null
type Match = { tn: string; tf: string; ts: number | null; bn: string; bf: string; bs: number | null; win?: Win }

// --------- WC bracket wiring (fixture ids → geometry slots) -----------------
// Derived from the R16+ pairings in lib/fixtures.ts (W<id> references), so the
// tree below feeds winners into exactly the matches the schedule defines.
//   R16 89=W74,W77  90=W73,W75  91=W76,W78  92=W79,W80
//       93=W83,W84  94=W81,W82  95=W86,W88  96=W85,W87
//   QF  97=W89,W90  98=W93,W94  99=W91,W92  100=W95,W96
//   SF  101=W97,W98 102=W99,W100   Final 104=W101,W102
type SideIds = { r0: number[]; r1: number[]; r2: number[]; r3: number[] }

const WC_LEFT: SideIds = {
  r0: [74, 77, 73, 75, 83, 84, 81, 82],
  r1: [89, 90, 93, 94],
  r2: [97, 98],
  r3: [101],
}
const WC_RIGHT: SideIds = {
  r0: [76, 78, 79, 80, 86, 88, 85, 87],
  r1: [91, 92, 95, 96],
  r2: [99, 100],
  r3: [102],
}
const WC_FINAL_ID = 104

// --------- Párbaj seeding (standard 32-team single-elim bracket order) -------
// Seeds are 1-based finishing places from the frozen round-10 standings.
const PB_LEFT_SEEDS: ReadonlyArray<readonly [number, number]> = [
  [1, 32], [16, 17], [8, 25], [9, 24], [4, 29], [13, 20], [5, 28], [12, 21],
]
const PB_RIGHT_SEEDS: ReadonlyArray<readonly [number, number]> = [
  [2, 31], [15, 18], [7, 26], [10, 23], [3, 30], [14, 19], [6, 27], [11, 22],
]

// ---------------------------- geometry -------------------------------------

const CARD_W = 140
const CARD_H = 54
const CONN = 34
const VGAP = 18
const LABEL_H = 34
const P0 = CARD_H + VGAP // 72
const sideW = 4 * (CARD_W + CONN) // 696
const finalGap = 44
const finalW = 156
const rightX0 = sideW + finalGap + finalW + finalGap // 940
const stageW = rightX0 + sideW // 1636
const stageH = P0 * 8 + LABEL_H // 610
const cyMid = P0 * 4 + LABEL_H // 322
const finalLeft = sideW + finalGap // 740
const finalRight = finalLeft + finalW // 896

const LINE_COLOR = '#cfe0de'
const EMPTY: Match = { tn: '—', tf: '', ts: null, bn: '—', bf: '', bs: null, win: null }

// ----------------------------- data → matches ------------------------------

function decideWin(res?: { h: number; a: number; pen_h?: number; pen_a?: number } | null): Win {
  if (!res) return null
  if (res.h > res.a) return 't'
  if (res.a > res.h) return 'b'
  if (res.pen_h != null && res.pen_a != null) {
    if (res.pen_h > res.pen_a) return 't'
    if (res.pen_a > res.pen_h) return 'b'
  }
  return null
}

function winner(mt: Match): { n: string; f: string } | null {
  if (mt.win === 't') return { n: mt.tn, f: mt.tf }
  if (mt.win === 'b') return { n: mt.bn, f: mt.bf }
  return null
}

// One WC match from live state: teams via koTeams, scores via results.
function wcMatch(state: GameState, id: number): Match {
  const ko = state.koTeams?.[String(id)]
  const res = state.results?.[String(id)] ?? null
  const home = ko?.home
  const away = ko?.away
  return {
    tn: home || '—',
    tf: home ? flag(home) : '',
    ts: res ? res.h : null,
    bn: away || '—',
    bf: away ? flag(away) : '',
    bs: res ? res.a : null,
    win: decideWin(res),
  }
}

// Build a WC half (R32 → SF). koTeams is preferred for every round; where a
// later-round slot has no team yet, fall back to the winner of the feeding
// match (advance via results).
function buildWcSide(state: GameState, ids: SideIds): Match[][] {
  const rounds: Match[][] = [ids.r0.map((id) => wcMatch(state, id))]
  const next = [ids.r1, ids.r2, ids.r3]
  next.forEach((idList, idx) => {
    const r = idx + 1
    const prev = rounds[r - 1]
    rounds.push(
      idList.map((id, j) => {
        const m = wcMatch(state, id)
        if (m.tn === '—') {
          const w = winner(prev[2 * j])
          if (w) { m.tn = w.n; m.tf = w.f }
        }
        if (m.bn === '—') {
          const w = winner(prev[2 * j + 1])
          if (w) { m.bn = w.n; m.bf = w.f }
        }
        return m
      }),
    )
  })
  return rounds
}

function emptyRound(n: number): Match[] {
  return Array.from({ length: n }, () => ({ ...EMPTY }))
}

// Map seed (1-based place) → player name from the frozen standings.
function seedName(bySeed: Record<number, string>, seed: number): string {
  return bySeed[seed] || '—'
}

// Build a Párbaj half. Only the seeding round is populated (no playoff result
// feed); later rounds are placeholders.
function buildPbSide(bySeed: Record<number, string>, seeds: ReadonlyArray<readonly [number, number]>): Match[][] {
  const r0: Match[] = seeds.map(([a, b]) => ({
    tn: seedName(bySeed, a), tf: '', ts: null,
    bn: seedName(bySeed, b), bf: '', bs: null, win: null,
  }))
  return [r0, emptyRound(4), emptyRound(2), emptyRound(1)]
}

// ----------------------------- view-models ---------------------------------

type CardVM = {
  key: string
  style: CSSProperties
  topF: string; topN: string; topS: string; topStyle: CSSProperties; topScoreStyle: CSSProperties
  botF: string; botN: string; botS: string; botStyle: CSSProperties; botScoreStyle: CSSProperties
}
type LineVM = { key: string; style: CSSProperties }
type LabelVM = { key: string; text: string; style: CSSProperties }

function cardStyles(mt: Match, mine: string) {
  const decided = mt.win != null
  const topWin = mt.win === 't'
  const botWin = mt.win === 'b'
  const mineTop = mt.tn !== '—' && mt.tn === mine
  const mineBot = mt.bn !== '—' && mt.bn === mine
  const mineHere = mineTop || mineBot

  const base: CSSProperties = {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    background: '#fff',
    borderRadius: 11,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(13,51,49,.07)',
    display: 'flex',
    flexDirection: 'column',
    border: mineHere ? '2px solid #14a08c' : '1px solid #E1EAEA',
  }
  const row = (win: boolean, mineRow: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    padding: '0 9px',
    fontSize: 12,
    ...(mineRow ? { background: 'rgba(20,160,140,.12)' } : {}),
    color: win ? '#007E73' : '#11302E',
    fontWeight: win ? 800 : 600,
    ...(decided && !win ? { opacity: 0.5 } : {}),
  })
  const sc = (win: boolean): CSSProperties => ({
    flex: 'none',
    fontWeight: 900,
    fontSize: 13,
    color: win ? '#007E73' : 'rgba(13,51,49,.45)',
  })
  return {
    base,
    topStyle: row(topWin, mineTop),
    botStyle: row(botWin, mineBot),
    topScoreStyle: sc(topWin),
    botScoreStyle: sc(botWin),
    topS: mt.ts == null ? '' : String(mt.ts),
    botS: mt.bs == null ? '' : String(mt.bs),
  }
}

function buildSide(
  rounds: Match[][],
  x0: number,
  mirror: boolean,
  mine: string,
  cards: CardVM[],
  lines: LineVM[],
  roundLefts: number[],
  keyPrefix: string,
) {
  const mapX = (lx: number, w: number) => (mirror ? x0 + (sideW - lx - w) : x0 + lx)
  rounds.forEach((ms, r) => {
    const pitch = P0 * Math.pow(2, r)
    const lx = r * (CARD_W + CONN)
    roundLefts[r] = mapX(lx, CARD_W)
    ms.forEach((mt, m) => {
      const cy = pitch * (m + 0.5) + LABEL_H
      const st = cardStyles(mt, mine)
      cards.push({
        key: `${keyPrefix}-c-${r}-${m}`,
        style: { ...st.base, left: mapX(lx, CARD_W), top: cy - CARD_H / 2 },
        topF: mt.tf, topN: mt.tn, topS: st.topS, topStyle: st.topStyle, topScoreStyle: st.topScoreStyle,
        botF: mt.bf, botN: mt.bn, botS: st.botS, botStyle: st.botStyle, botScoreStyle: st.botScoreStyle,
      })
    })
    if (r < rounds.length - 1) {
      const cnt = Math.ceil(ms.length / 2)
      for (let i = 0; i < cnt; i++) {
        const cyT = pitch * (2 * i + 0.5) + LABEL_H
        const cyB = pitch * (2 * i + 1 + 0.5) + LABEL_H
        const cyM = (cyT + cyB) / 2
        const stubX = lx + CARD_W
        const vX = stubX + CONN / 2
        const seg = (style: CSSProperties): CSSProperties => ({ background: LINE_COLOR, position: 'absolute', ...style })
        lines.push({ key: `${keyPrefix}-l-${r}-${i}-st`, style: seg({ left: mapX(stubX, CONN / 2), top: cyT - 1, width: CONN / 2, height: 2 }) })
        lines.push({ key: `${keyPrefix}-l-${r}-${i}-sb`, style: seg({ left: mapX(stubX, CONN / 2), top: cyB - 1, width: CONN / 2, height: 2 }) })
        lines.push({ key: `${keyPrefix}-l-${r}-${i}-v`, style: seg({ left: mapX(vX, 2), top: cyT, width: 2, height: cyB - cyT }) })
        lines.push({ key: `${keyPrefix}-l-${r}-${i}-in`, style: seg({ left: mapX(vX, CONN / 2), top: cyM - 1, width: CONN / 2, height: 2 }) })
      }
    }
  })
}

function Card({ c }: { c: CardVM }) {
  return (
    <div style={c.style}>
      <div style={c.topStyle}>
        <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{c.topF}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.topN}</span>
        <span style={c.topScoreStyle}>{c.topS}</span>
      </div>
      <div style={{ height: 1, background: '#EEF3F3' }} />
      <div style={c.botStyle}>
        <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{c.botF}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.botN}</span>
        <span style={c.botScoreStyle}>{c.botS}</span>
      </div>
    </div>
  )
}

// Map each player to their finishing place (frozen standings → seed lookup).
function seedMap(standings: SwissStanding[]): Record<number, string> {
  const sorted = [...standings].sort((a, b) => (a.place ?? 9_999) - (b.place ?? 9_999))
  const out: Record<number, string> = {}
  sorted.forEach((s, i) => {
    const place = s.place ?? i + 1
    if (!out[place]) out[place] = s.name
  })
  return out
}

// ----------------------------- placeholder ---------------------------------

function Notice({ text }: { text: string }) {
  return (
    <div
      className="broadcast-dark mb-4 flex flex-col items-center gap-2 rounded-[18px] px-5 py-10 text-center text-white"
      style={{ boxShadow: '0 12px 30px rgba(12,77,73,.25)' }}
    >
      <span style={{ fontSize: 32 }}>🪜</span>
      <div style={{ fontSize: 15, fontWeight: 800, maxWidth: 320, lineHeight: 1.4 }}>{text}</div>
    </div>
  )
}

// ----------------------------- component -----------------------------------

export function Bracket({ variant }: { variant: 'parbaj' | 'wc' }) {
  const { state, session } = useGame()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Center the stage horizontally whenever the data identity changes.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [variant, state])

  if (!state) {
    return <Notice text="Ágrajz betöltése…" />
  }

  const player = session?.player ?? ''

  // Resolve "mine" — the highlighted name.
  // WC: the player's favourite team (post-switch if switched). Párbaj: the player.
  let mine = player
  if (variant === 'wc') {
    const fav = player ? state.favorites?.[encodeClientKey(player)] : undefined
    mine = fav ? (fav.switched ? fav.newTeam || fav.team : fav.team) : ''
  }

  // Párbaj with no frozen seeding yet → graceful notice.
  const standings = state.swiss?.standings ?? []
  if (variant === 'parbaj' && standings.length === 0) {
    return <Notice text="A rájátszás a 10. forduló után indul — addig a befagyasztott tabella adja a kiemelést." />
  }

  // Build both halves.
  let leftRounds: Match[][]
  let rightRounds: Match[][]
  if (variant === 'wc') {
    leftRounds = buildWcSide(state, WC_LEFT)
    rightRounds = buildWcSide(state, WC_RIGHT)
  } else {
    const bySeed = seedMap(standings)
    leftRounds = buildPbSide(bySeed, PB_LEFT_SEEDS)
    rightRounds = buildPbSide(bySeed, PB_RIGHT_SEEDS)
  }

  // Final pairing: prefer koTeams[104] (WC), else winners of the two SFs.
  const leftSFWin = winner(leftRounds[3][0])
  const rightSFWin = winner(rightRounds[3][0])
  let finalMt: Match = {
    tn: leftSFWin?.n ?? '—', tf: leftSFWin?.f ?? '', ts: null,
    bn: rightSFWin?.n ?? '—', bf: rightSFWin?.f ?? '', bs: null, win: null,
  }
  if (variant === 'wc') {
    const ko = state.koTeams?.[String(WC_FINAL_ID)]
    const res = state.results?.[String(WC_FINAL_ID)] ?? null
    finalMt = {
      tn: ko?.home || finalMt.tn,
      tf: ko?.home ? flag(ko.home) : finalMt.tf,
      ts: res ? res.h : null,
      bn: ko?.away || finalMt.bn,
      bf: ko?.away ? flag(ko.away) : finalMt.bf,
      bs: res ? res.a : null,
      win: decideWin(res),
    }
  }
  const finalKnown = finalMt.tn !== '—' || finalMt.bn !== '—'

  const cards: CardVM[] = []
  const lines: LineVM[] = []
  const roundLeftsL: number[] = []
  const roundLeftsR: number[] = []
  buildSide(leftRounds, 0, false, mine, cards, lines, roundLeftsL, 'L')
  buildSide(rightRounds, rightX0, true, mine, cards, lines, roundLeftsR, 'R')

  // SF -> final connectors
  const leftSFright = 3 * (CARD_W + CONN) + CARD_W // 662
  const rightSFleft = rightX0 + (sideW - 3 * (CARD_W + CONN) - CARD_W) // 974
  lines.push({ key: 'sf-left', style: { background: LINE_COLOR, position: 'absolute', left: leftSFright, top: cyMid - 1, width: finalLeft - leftSFright, height: 2 } })
  lines.push({ key: 'sf-right', style: { background: LINE_COLOR, position: 'absolute', left: finalRight, top: cyMid - 1, width: rightSFleft - finalRight, height: 2 } })

  // round labels
  const lblBase: CSSProperties = {
    position: 'absolute',
    top: 6,
    transform: 'translateX(-50%)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '.08em',
    color: 'rgba(13,51,49,.5)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
  const names = ['Nyolcad', 'Negyed', 'Elő', 'SF']
  const labels: LabelVM[] = []
  ;[0, 1, 2, 3].forEach((r) => {
    labels.push({ key: `lblL-${r}`, text: names[r], style: { ...lblBase, left: roundLeftsL[r] + CARD_W / 2 } })
  })
  labels.push({ key: 'lblC', text: 'Döntő', style: { ...lblBase, left: finalLeft + finalW / 2, color: '#007E73' } })
  ;[3, 2, 1, 0].forEach((r) => {
    labels.push({ key: `lblR-${r}`, text: names[r], style: { ...lblBase, left: roundLeftsR[r] + CARD_W / 2 } })
  })

  // final (center) card
  const finalCardStyle: CSSProperties = {
    position: 'absolute',
    left: finalLeft,
    top: cyMid - 46,
    width: finalW,
    background: 'linear-gradient(160deg,#0C4D49,#0F6A64)',
    borderRadius: 13,
    padding: '7px 0 4px',
    boxShadow: '0 10px 26px rgba(12,77,73,.35)',
    border: '1px solid rgba(255,255,255,.12)',
  }
  const fRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 13, fontWeight: 800, color: '#fff' }

  const finalLine = finalKnown
    ? `${finalMt.tn} ${finalMt.tf}  vs  ${finalMt.bf} ${finalMt.bn}`.replace(/\s+/g, ' ').trim()
    : 'TBD'
  const yourPick = mine ? `${mine} — bajnok` : 'TBD'

  return (
    <div className="mb-4">
      {/* champion strip */}
      <div
        className="broadcast-dark mb-[14px] flex items-center gap-4 rounded-[18px] px-[18px] py-4 text-white"
        style={{ boxShadow: '0 12px 30px rgba(12,77,73,.25)' }}
      >
        <span style={{ fontSize: 34 }}>🏆</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.12em', color: '#9fe6dd' }}>DÖNTŐ</div>
          <div style={{ fontSize: 17, fontWeight: 900, marginTop: 2 }}>{finalLine}</div>
        </div>
        {mine ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#9fe6dd', fontWeight: 700 }}>A te tipped</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#FFD700' }}>{yourPick}</div>
          </div>
        ) : null}
      </div>

      {/* bracket stage (horizontal scroll) */}
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', paddingBottom: 14, scrollbarWidth: 'thin', scrollbarColor: '#bcdedb transparent' }}
      >
        <div style={{ position: 'relative', width: stageW, height: stageH, minWidth: stageW }}>
          {labels.map((l) => (
            <div key={l.key} style={l.style}>{l.text}</div>
          ))}
          {lines.map((ln) => (
            <div key={ln.key} style={ln.style} />
          ))}
          {cards.map((c) => (
            <Card key={c.key} c={c} />
          ))}
          {/* final + champion node */}
          <div style={finalCardStyle}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.1em', color: '#9fe6dd', textAlign: 'center', textTransform: 'uppercase' }}>
              Döntő
            </div>
            <div style={fRow}>
              <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{finalMt.tf}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finalMt.tn}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,.18)' }} />
            <div style={fRow}>
              <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{finalMt.bf}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finalMt.bn}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(13,51,49,.45)', marginTop: -4 }}>
        ← húzd oldalra a teljes ágrajzhoz →
      </div>
    </div>
  )
}

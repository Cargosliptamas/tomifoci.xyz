'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Converging "March Madness" knockout bracket (ágrajz).
// Geometry ported faithfully from the design handoff
// (design_handoff_vbtippjatek_redesign/Tomifoci 2026 - Brackets.dc.html).
// Two sides converge on a center final: left fills L->R, right mirrored R->L.
// ---------------------------------------------------------------------------

type Match = { tn: string; tf: string; ts: number | null; bn: string; bf: string; bs: number | null }
type SideData = { seed: Match[]; adv: Record<number, ReadonlyArray<readonly [number, number]>> }
type BracketData = {
  mine: string
  left: SideData
  right: SideData
  final: { tn: string; tf: string; bn: string; bf: string }
}

// ---------------------------- seed data ------------------------------------

const WC: BracketData = {
  mine: 'Brazília',
  left: {
    seed: [
      { tn: 'Argentína', tf: '🇦🇷', ts: 2, bn: 'Ausztria', bf: '🇦🇹', bs: 0 },
      { tn: 'Marokkó', tf: '🇲🇦', ts: 2, bn: 'Horváto.', bf: '🇭🇷', bs: 1 },
      { tn: 'Németo.', tf: '🇩🇪', ts: 3, bn: 'Szenegál', bf: '🇸🇳', bs: 1 },
      { tn: 'Portugália', tf: '🇵🇹', ts: 2, bn: 'Uruguay', bf: '🇺🇾', bs: 1 },
      { tn: 'Spanyolo.', tf: '🇪🇸', ts: 2, bn: 'Japán', bf: '🇯🇵', bs: 0 },
      { tn: 'Belgium', tf: '🇧🇪', ts: 2, bn: 'Kolumbia', bf: '🇨🇴', bs: 1 },
      { tn: 'Hollandia', tf: '🇳🇱', ts: 3, bn: 'Ecuador', bf: '🇪🇨', bs: 2 },
      { tn: 'Brazília', tf: '🇧🇷', ts: 2, bn: 'Svájc', bf: '🇨🇭', bs: 0 },
    ],
    adv: { 1: [[1, 0], [1, 2], [2, 1], [1, 3]], 2: [[2, 1], [0, 2]], 3: [[0, 1]] },
  },
  right: {
    seed: [
      { tn: 'Franciao.', tf: '🇫🇷', ts: 2, bn: 'Norvégia', bf: '🇳🇴', bs: 1 },
      { tn: 'Anglia', tf: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ts: 3, bn: 'Egyiptom', bf: '🇪🇬', bs: 0 },
      { tn: 'Dél-Korea', tf: '🇰🇷', ts: 2, bn: 'Mexikó', bf: '🇲🇽', bs: 1 },
      { tn: 'USA', tf: '🇺🇸', ts: 2, bn: 'Ausztrália', bf: '🇦🇺', bs: 1 },
      { tn: 'Katar', tf: '🇶🇦', ts: 1, bn: 'Kanada', bf: '🇨🇦', bs: 0 },
      { tn: 'Tunézia', tf: '🇹🇳', ts: 2, bn: 'Szaúd-A.', bf: '🇸🇦', bs: 1 },
      { tn: 'Elefántcs.', tf: '🇨🇮', ts: 2, bn: 'Paraguay', bf: '🇵🇾', bs: 1 },
      { tn: 'Üzbég.', tf: '🇺🇿', ts: 2, bn: 'Panama', bf: '🇵🇦', bs: 0 },
    ],
    adv: { 1: [[2, 1], [0, 2], [0, 1], [2, 1]], 2: [[3, 1], [0, 1]], 3: [[2, 0]] },
  },
  final: { tn: 'Brazília', tf: '🇧🇷', bn: 'Franciao.', bf: '🇫🇷' },
}

const PB: BracketData = {
  mine: 'Tomi',
  left: {
    seed: [
      { tn: 'Tomi', tf: '', ts: 24, bn: 'Zsolt', bf: '', bs: 19 },
      { tn: 'Bence', tf: '', ts: 21, bn: 'Áron', bf: '', bs: 28 },
      { tn: 'Dávid', tf: '', ts: 26, bn: 'Gergő', bf: '', bs: 22 },
      { tn: 'Marci', tf: '', ts: 18, bn: 'Petra', bf: '', bs: 25 },
      { tn: 'Kata', tf: '', ts: 23, bn: 'Levi', bf: '', bs: 20 },
      { tn: 'Nóra', tf: '', ts: 27, bn: 'Bálint', bf: '', bs: 24 },
      { tn: 'Gábor', tf: '', ts: 22, bn: 'Eszter', bf: '', bs: 26 },
      { tn: 'Tamás', tf: '', ts: 30, bn: 'Réka', bf: '', bs: 21 },
    ],
    adv: { 1: [[26, 22], [20, 24], [19, 23], [25, 21]], 2: [[28, 25], [22, 24]], 3: [[27, 21]] },
  },
  right: {
    seed: [
      { tn: 'Máté', tf: '', ts: 25, bn: 'Andris', bf: '', bs: 22 },
      { tn: 'Viktor', tf: '', ts: 20, bn: 'Csaba', bf: '', bs: 27 },
      { tn: 'Ádám', tf: '', ts: 29, bn: 'Roland', bf: '', bs: 24 },
      { tn: 'Botond', tf: '', ts: 23, bn: 'Olivér', bf: '', bs: 26 },
      { tn: 'Dénes', tf: '', ts: 22, bn: 'Feri', bf: '', bs: 19 },
      { tn: 'Imre', tf: '', ts: 26, bn: 'Józsi', bf: '', bs: 28 },
      { tn: 'Karcsi', tf: '', ts: 24, bn: 'Laci', bf: '', bs: 21 },
      { tn: 'Norbi', tf: '', ts: 18, bn: 'Pál', bf: '', bs: 23 },
    ],
    adv: { 1: [[24, 27], [26, 22], [21, 25], [23, 20]], 2: [[28, 30], [24, 22]], 3: [[27, 25]] },
  },
  final: { tn: 'Tomi', tf: '', bn: 'Ádám', bf: '' },
}

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

function winner(mt: Match): { n: string; f: string } | null {
  if (mt.ts == null || mt.bs == null) return null
  return mt.ts >= mt.bs ? { n: mt.tn, f: mt.tf } : { n: mt.bn, f: mt.bf }
}

// Build rounds 0..3 by pairing adjacent winners and applying adv[] scores.
function buildRounds(side: SideData): Match[][] {
  const rounds: Match[][] = [side.seed.map((s) => ({ ...s }))]
  for (let r = 1; r <= 3; r++) {
    const prev = rounds[r - 1]
    const out: Match[] = []
    for (let j = 0; j < prev.length / 2; j++) {
      const wt = winner(prev[2 * j])
      const wb = winner(prev[2 * j + 1])
      const sc = side.adv[r]?.[j] ?? null
      out.push({
        tn: wt ? wt.n : '—', tf: wt ? wt.f : '', ts: sc ? sc[0] : null,
        bn: wb ? wb.n : '—', bf: wb ? wb.f : '', bs: sc ? sc[1] : null,
      })
    }
    rounds.push(out)
  }
  return rounds
}

type CardVM = {
  key: string
  style: CSSProperties
  topF: string; topN: string; topS: string; topStyle: CSSProperties; topScoreStyle: CSSProperties
  botF: string; botN: string; botS: string; botStyle: CSSProperties; botScoreStyle: CSSProperties
}
type LineVM = { key: string; style: CSSProperties }
type LabelVM = { key: string; text: string; style: CSSProperties }

function cardStyles(mt: Match, mine: string) {
  const played = mt.ts != null && mt.bs != null
  const topWin = played && (mt.ts as number) >= (mt.bs as number)
  const botWin = played && (mt.bs as number) > (mt.ts as number)
  const mineTop = mt.tn === mine
  const mineBot = mt.bn === mine
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
    ...(played && !win ? { opacity: 0.5 } : {}),
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

export function Bracket({ variant }: { variant: 'parbaj' | 'wc' }) {
  const data = variant === 'parbaj' ? PB : WC
  const mine = data.mine
  const f = data.final

  const cards: CardVM[] = []
  const lines: LineVM[] = []
  const roundLeftsL: number[] = []
  const roundLeftsR: number[] = []
  buildSide(buildRounds(data.left), 0, false, mine, cards, lines, roundLeftsL, 'L')
  buildSide(buildRounds(data.right), rightX0, true, mine, cards, lines, roundLeftsR, 'R')

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

  const finalLine = `${f.tn} ${f.tf}  vs  ${f.bf} ${f.bn}`.replace(/\s+/g, ' ').trim()
  const yourPick = variant === 'parbaj' ? 'Tomi — bajnok' : 'Brazília — bajnok'

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [variant])

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
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9fe6dd', fontWeight: 700 }}>A te tipped</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#FFD700' }}>{yourPick}</div>
        </div>
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
              Döntő · él
            </div>
            <div style={fRow}>
              <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{f.tf}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.tn}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,.18)' }} />
            <div style={fRow}>
              <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{f.bf}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.bn}</span>
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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { getSql } from './db'

// LiveScore-API ingestion. Pulls pre-match odds + final scores and maps them to our match
// ids (group/test by hu team-name; knockout by team-pair against the authoritative koTeams
// slot assignment). Writes odds → apiCache, final scores → results (merge-upsert, INV-11).
// Knockout SLOT→TEAMS assignment is owned by koTeams, not decided here.

const LS_BASE = 'https://livescore-api.com/api-client'
const COMPS = [362, 371, 1] // WC, friendly, friendly2

const TEAM_ALIAS: Record<string, string> = {
  'Amerikai Egyesült Államok': 'Egyesült Államok',
  'Kongói Demokratikus Köztársaság (Zaire)': 'Kongói DK',
  'Zöld-foki Köztársaság': 'Zöld-foki-szigetek',
  'Dél-Korea (Koreai Köztársaság)': 'Dél-Korea'
}
const canon = (n: string) => TEAM_ALIAS[n] || n
const norm = (s: string) => (s || '').toLowerCase().normalize('NFC').trim()

type Ref = { id: number; reversed: boolean }

export type PollSummary = {
  ok: boolean
  fixturesSeen: number
  oddsMapped: number
  resultsWritten: number
  unmatched: number
  ts: number
  error?: string
}

async function ls(key: string, secret: string, endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ key, secret, ...params })
  const r = await fetch(`${LS_BASE}${endpoint}?${qs}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${endpoint} HTTP ${r.status}`)
  const j = (await r.json()) as { success?: boolean; data?: any; error?: string }
  if (j.success === false) throw new Error(`${endpoint}: ${j.error ?? 'failed'}`)
  return j.data
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}
function parseScore(s: unknown): { h: number; a: number } | null {
  const m = /^\s*(\d+)\s*[-:]\s*(\d+)\s*$/.exec(String(s ?? ''))
  return m ? { h: Number(m[1]), a: Number(m[2]) } : null
}

function loadDataFixtures(): Array<{ id: number; home: string; away: string; stage: string }> {
  for (const p of [join(process.cwd(), 'public', 'classic', 'data.js'), join(process.cwd(), 'data.js')]) {
    try {
      const ctx: Record<string, any> = {}
      runInNewContext(
        readFileSync(p, 'utf8') +
          '\n;globalThis.__M__ = MATCHES.map(m => ({ id: m.id, home: m.home, away: m.away, stage: m.stage }));',
        ctx,
        { timeout: 2000 }
      )
      return ctx.__M__ ?? []
    } catch {
      // try next path
    }
  }
  return []
}

export async function runLiveScorePoll(): Promise<PollSummary> {
  const key = process.env.LS_KEY
  const secret = process.env.LS_SECRET
  if (!key || !secret) {
    return { ok: false, fixturesSeen: 0, oddsMapped: 0, resultsWritten: 0, unmatched: 0, ts: Date.now(), error: 'ls-not-configured' }
  }
  const sql = getSql()

  // Build team-pair → our match id (group/test from data.js; knockout from koTeams).
  const pairToId = new Map<string, Ref>()
  for (const m of loadDataFixtures()) {
    if (m.stage === 'ko') continue
    pairToId.set(`${norm(m.home)}::${norm(m.away)}`, { id: m.id, reversed: false })
    pairToId.set(`${norm(m.away)}::${norm(m.home)}`, { id: m.id, reversed: true })
  }
  const koRows = await sql`SELECT convex_id, payload FROM imported_rows WHERE table_name = 'koTeams'`
  for (const r of koRows as Array<{ convex_id: string; payload: any }>) {
    const p = r.payload
    if (!p?.home || !p?.away) continue
    const id = Number(r.convex_id)
    pairToId.set(`${norm(canon(p.home))}::${norm(canon(p.away))}`, { id, reversed: false })
    pairToId.set(`${norm(canon(p.away))}::${norm(canon(p.home))}`, { id, reversed: true })
  }
  const findId = (h: string, a: string) => pairToId.get(`${norm(h)}::${norm(a)}`) ?? null

  const oddsMap: Record<number, { h: number; x: number; a: number }> = {}
  const results: Record<number, { h: number; a: number }> = {}
  let fixturesSeen = 0
  let unmatched = 0

  try {
    for (const comp of COMPS) {
      let data
      try {
        data = await ls(key, secret, '/fixtures/matches.json', { competition_id: String(comp) })
      } catch {
        continue
      }
      for (const f of data?.fixtures ?? data ?? []) {
        fixturesSeen++
        const huHome = canon(f.home_translations?.hu || f.home_name)
        const huAway = canon(f.away_translations?.hu || f.away_name)
        const pre = f.odds?.pre
        if (!pre) continue
        const ref = findId(huHome, huAway)
        if (!ref) {
          unmatched++
          continue
        }
        const o = ref.reversed
          ? { h: num(pre['2']), x: num(pre['X']), a: num(pre['1']) }
          : { h: num(pre['1']), x: num(pre['X']), a: num(pre['2']) }
        if (o.h || o.x || o.a) oddsMap[ref.id] = o
      }
    }

    for (const comp of COMPS) {
      let data
      try {
        data = await ls(key, secret, '/matches/history.json', { competition_id: String(comp) })
      } catch {
        continue
      }
      for (const m of data?.match ?? data ?? []) {
        const ref = findId(canon(m.home_translations?.hu || m.home_name), canon(m.away_translations?.hu || m.away_name))
        if (!ref) continue
        const sc = parseScore(m.ft_score || m.score)
        if (!sc) continue
        results[ref.id] = ref.reversed ? { h: sc.a, a: sc.h } : { h: sc.h, a: sc.a }
      }
    }

    // Write odds (recomputable cache) + final scores (merge-upsert).
    await sql`
      INSERT INTO imported_rows (table_name, convex_id, payload)
      VALUES ('apiCache', 'odds', ${JSON.stringify({ kind: 'odds', ts: Date.now(), data: oddsMap })}::jsonb)
      ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
    `
    let resultsWritten = 0
    for (const [mid, r] of Object.entries(results)) {
      await sql`
        INSERT INTO results (match_id, h, a) VALUES (${Number(mid)}, ${r.h}, ${r.a})
        ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
      `
      resultsWritten++
    }

    return { ok: true, fixturesSeen, oddsMapped: Object.keys(oddsMap).length, resultsWritten, unmatched, ts: Date.now() }
  } catch (error) {
    return {
      ok: false,
      fixturesSeen,
      oddsMapped: Object.keys(oddsMap).length,
      resultsWritten: 0,
      unmatched,
      ts: Date.now(),
      error: error instanceof Error ? error.message : 'unknown'
    }
  }
}

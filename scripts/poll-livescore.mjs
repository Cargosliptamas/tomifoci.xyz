#!/usr/bin/env node
// LiveScore-API ingestion (odds). Fetches WC + friendly fixtures and maps their pre-match
// odds to our match ids: GROUP/TEST games by Hungarian team-name pair, KNOCKOUT games by
// matching the API team-pair to the authoritative koTeams slot assignment already in Neon
// (the bracket seeding comes from the classic game, NOT chronological order — see note below).
//
// Knockout SLOT→TEAMS assignment is NOT done here: it is owned by koTeams (synced from the
// classic/Convex bracket or set by admin). This script only attaches odds + final scores to
// the correct match id; it never decides which teams are in which slot.
//
// Credentials from env (never hardcoded): LS_KEY, LS_SECRET, DATABASE_URL.
// Default DRY RUN. Pass --apply to write.

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const APPLY = process.argv.includes('--apply')
const LS_KEY = process.env.LS_KEY
const LS_SECRET = process.env.LS_SECRET
const DATABASE_URL = process.env.DATABASE_URL
if (!LS_KEY || !LS_SECRET || !DATABASE_URL) {
  console.error('✗ Set LS_KEY, LS_SECRET and DATABASE_URL')
  process.exit(2)
}

const LS_BASE = 'https://livescore-api.com/api-client'
const COMPS = [362, 371, 1]
const sql = neon(DATABASE_URL)

async function ls(endpoint, params) {
  const qs = new URLSearchParams({ key: LS_KEY, secret: LS_SECRET, ...params })
  const r = await fetch(`${LS_BASE}${endpoint}?${qs}`)
  if (!r.ok) throw new Error(`${endpoint} HTTP ${r.status}`)
  const j = await r.json()
  if (j.success === false) throw new Error(`${endpoint}: ${j.error ?? 'failed'}`)
  return j.data
}

const norm = (s) => (s || '').toLowerCase().normalize('NFC').trim()

// A few API Hungarian names differ from our canonical data.js names.
const TEAM_ALIAS = {
  'Amerikai Egyesült Államok': 'Egyesült Államok',
  'Kongói Demokratikus Köztársaság (Zaire)': 'Kongói DK',
  'Zöld-foki Köztársaság': 'Zöld-foki-szigetek',
  'Dél-Korea (Koreai Köztársaság)': 'Dél-Korea'
}
const canon = (n) => TEAM_ALIAS[n] || n

// ── Group/test fixtures (hu name-pair → our match id) from data.js ───────────────
const ctx = {}
runInNewContext(
  readFileSync('public/classic/data.js', 'utf8') +
    '\n;globalThis.__M__ = MATCHES.map(m => ({ id: m.id, home: m.home, away: m.away, stage: m.stage }));',
  ctx,
  { timeout: 2000 }
)
const pairToId = new Map()
for (const m of ctx.__M__) {
  if (m.stage === 'ko') continue
  pairToId.set(`${norm(m.home)}::${norm(m.away)}`, { id: m.id, reversed: false })
  pairToId.set(`${norm(m.away)}::${norm(m.home)}`, { id: m.id, reversed: true })
}

// ── Knockout slot assignment (authoritative) from koTeams in Neon ────────────────
const koRows = await sql`SELECT convex_id, payload FROM imported_rows WHERE table_name = 'koTeams'`
for (const r of koRows) {
  const p = r.payload
  if (!p?.home || !p?.away) continue
  pairToId.set(`${norm(canon(p.home))}::${norm(canon(p.away))}`, { id: Number(r.convex_id), reversed: false })
  pairToId.set(`${norm(canon(p.away))}::${norm(canon(p.home))}`, { id: Number(r.convex_id), reversed: true })
}

function findId(huHome, huAway) {
  return pairToId.get(`${norm(huHome)}::${norm(huAway)}`) ?? null
}
function num(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}
function parseScore(s) {
  const m = /^\s*(\d+)\s*[-:]\s*(\d+)\s*$/.exec(String(s ?? ''))
  return m ? { h: Number(m[1]), a: Number(m[2]) } : null
}

// ── Fetch fixtures (odds) ────────────────────────────────────────────────────────
const oddsMap = {}
let fixturesSeen = 0
let unmatched = 0
for (const comp of COMPS) {
  let data
  try {
    data = await ls('/fixtures/matches.json', { competition_id: comp })
  } catch {
    continue
  }
  for (const f of data?.fixtures ?? data ?? []) {
    fixturesSeen++
    const huHome = canon(f.home_translations?.hu || f.home_name)
    const huAway = canon(f.away_translations?.hu || f.away_name)
    const pre = f.odds?.pre
    if (!pre) continue
    const found = findId(huHome, huAway)
    if (!found) {
      unmatched++
      continue
    }
    const o = found.reversed
      ? { h: num(pre['2']), x: num(pre['X']), a: num(pre['1']) }
      : { h: num(pre['1']), x: num(pre['X']), a: num(pre['2']) }
    if (o.h || o.x || o.a) oddsMap[found.id] = o
  }
}

// ── Fetch history (final scores) ─────────────────────────────────────────────────
const results = {}
for (const comp of COMPS) {
  let data
  try {
    data = await ls('/matches/history.json', { competition_id: comp })
  } catch {
    continue
  }
  for (const m of data?.match ?? data ?? []) {
    const huHome = canon(m.home_translations?.hu || m.home_name)
    const huAway = canon(m.away_translations?.hu || m.away_name)
    const found = findId(huHome, huAway)
    if (!found) continue
    const sc = parseScore(m.ft_score || m.score)
    if (!sc) continue
    results[found.id] = found.reversed ? { h: sc.a, a: sc.h } : { h: sc.h, a: sc.a }
  }
}

console.log(APPLY ? '── APPLY ──' : '── DRY RUN (pass --apply to write) ──')
console.log(`fixtures seen: ${fixturesSeen} · odds mapped: ${Object.keys(oddsMap).length} · unmatched: ${unmatched}`)
console.log(`final scores from history: ${Object.keys(results).length}`)
console.log('odds by match:', Object.entries(oddsMap).map(([id, o]) => `#${id}=${o.h}/${o.x}/${o.a}`).join('  '))

if (!APPLY) {
  console.log('\nDry run — re-run with --apply to write odds (apiCache) + results.')
  process.exit(0)
}

await sql`
  INSERT INTO imported_rows (table_name, convex_id, payload)
  VALUES ('apiCache', 'odds', ${JSON.stringify({ kind: 'odds', ts: Date.now(), data: oddsMap })}::jsonb)
  ON CONFLICT (table_name, convex_id) DO UPDATE SET payload = EXCLUDED.payload
`
let wrote = 0
for (const [mid, r] of Object.entries(results)) {
  await sql`
    INSERT INTO results (match_id, h, a) VALUES (${Number(mid)}, ${r.h}, ${r.a})
    ON CONFLICT (match_id) DO UPDATE SET h = EXCLUDED.h, a = EXCLUDED.a
  `
  wrote++
}
console.log(`\n✓ Wrote odds for ${Object.keys(oddsMap).length} matches; upserted ${wrote} results.`)

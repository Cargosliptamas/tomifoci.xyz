#!/usr/bin/env node
// Firecrawl site test — crawls every route of the deployed app (authenticated routes via
// the ?as=<TEST_LOGIN_USER> override) and flags pages that errored or rendered empty.
//
// Prereqs (you create these — I can't sign up for third-party services):
//   1. A Firecrawl account + API key  → set FIRECRAWL_API_KEY
//   2. In Vercel env: TEST_LOGIN_USER=Firecrawl  (enables the PIN-less crawler login)
//   3. Optionally SITE_URL (defaults to https://tomifoci.xyz)
//
// Usage:
//   FIRECRAWL_API_KEY=fc-... SITE_URL=https://tomifoci.xyz node scripts/firecrawl-test.mjs

const KEY = process.env.FIRECRAWL_API_KEY
const SITE = (process.env.SITE_URL || 'https://tomifoci.xyz').replace(/\/$/, '')
const AS = process.env.TEST_LOGIN_USER || 'Firecrawl'
if (!KEY) {
  console.error('✗ Set FIRECRAWL_API_KEY (create a Firecrawl account first).')
  process.exit(2)
}

// path, needsAuth, must-contain marker, must-NOT-contain error markers
const ROUTES = [
  { path: '/', auth: false, want: ['Belépés'] },
  { path: '/login', auth: false, want: ['Ki vagy te'] },
  { path: '/meccsek', auth: true, want: ['Meccsek'] },
  { path: '/tabella', auth: true, want: ['Tabella'] },
  { path: '/wizard', auth: true, want: ['Wizard'] },
  { path: '/parbaj', auth: true, want: ['Párbaj'] },
  { path: '/profil', auth: true, want: ['Profil'] },
  { path: '/brackets', auth: true, want: ['ágrajz', 'Brackets', 'Párbaj'] },
  { path: '/szabalyok', auth: true, want: ['Szabályok'] },
  { path: '/admin', auth: false, want: ['Admin konzol'] }
]
const ERROR_MARKERS = ['Application error', 'Nem érhető el az adatbázis', 'Internal Server Error', '404', 'Failed to']

async function scrape(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ url, formats: ['markdown'], waitFor: 4000, timeout: 30000 })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return String(json.data?.markdown ?? '')
}

let pass = 0
let fail = 0
console.log(`Firecrawl test → ${SITE} (auth as "${AS}")\n`)
for (const r of ROUTES) {
  const url = `${SITE}${r.path}${r.auth ? `?as=${encodeURIComponent(AS)}` : ''}`
  try {
    const md = await scrape(url)
    const hasErr = ERROR_MARKERS.find((m) => md.includes(m))
    const hasWant = r.want.some((w) => md.includes(w))
    if (hasErr) {
      console.log(`❌ ${r.path}  — error marker: "${hasErr}"`)
      fail++
    } else if (!hasWant && md.length < 200) {
      console.log(`⚠️  ${r.path}  — rendered thin/empty (${md.length} chars)`)
      fail++
    } else if (!hasWant) {
      console.log(`⚠️  ${r.path}  — expected content not found (${r.want.join('/')}), but page rendered`)
      pass++
    } else {
      console.log(`✅ ${r.path}  — OK (${md.length} chars)`)
      pass++
    }
  } catch (e) {
    console.log(`❌ ${r.path}  — ${e.message}`)
    fail++
  }
}
console.log(`\n${pass} ok · ${fail} flagged`)
process.exit(fail ? 1 : 0)

import { NextResponse } from 'next/server'
import { getSql, loadPublicStateFromNeon } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// One-click admin diagnostics — runs the DB/data-integrity self-tests live and reports
// pass/fail. Mirrors the monitoring scripts (drift, write-health, encoded-name reconciliation)
// so an operator can verify system health from the console without the CLI.
function authorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  return request.headers.get('x-admin-token') === token
}

const CONVEX_URL = process.env.CONVEX_URL || 'https://adept-roadrunner-530.eu-west-1.convex.cloud'

type Check = { name: string; ok: boolean; detail: string; severity: 'pass' | 'warn' | 'fail' }

async function convexState(): Promise<any | null> {
  try {
    const r = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'game:state', args: {}, format: 'json' }),
      cache: 'no-store'
    })
    const j = await r.json()
    return j.status === 'success' ? j.value : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  if (!process.env.ADMIN_TOKEN) return NextResponse.json({ ok: false, error: 'admin-not-configured' }, { status: 503 })
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const sql = getSql()
  const checks: Check[] = []
  const SENTINEL = 990099

  // 1) DB connectivity
  try {
    await sql`SELECT 1`
    checks.push({ name: 'Adatbázis kapcsolat', ok: true, detail: 'Neon elérhető', severity: 'pass' })
  } catch (e) {
    checks.push({ name: 'Adatbázis kapcsolat', ok: false, detail: e instanceof Error ? e.message : 'hiba', severity: 'fail' })
    return NextResponse.json({ ok: false, checks, ts: Date.now() })
  }

  // 2) Write-health: sentinel result insert → read → delete
  try {
    await sql`DELETE FROM results WHERE match_id = ${SENTINEL}`
    await sql`INSERT INTO results (match_id, h, a) VALUES (${SENTINEL}, 3, 1) ON CONFLICT (match_id) DO UPDATE SET h=3, a=1`
    const rb = await sql`SELECT h, a FROM results WHERE match_id = ${SENTINEL}`
    await sql`DELETE FROM results WHERE match_id = ${SENTINEL}`
    const ok = rb[0]?.h === 3 && rb[0]?.a === 1
    checks.push({ name: 'Írás-egészség (eredmény)', ok, detail: ok ? 'insert → read → delete sikeres' : 'visszaolvasás hibás', severity: ok ? 'pass' : 'fail' })
  } catch (e) {
    checks.push({ name: 'Írás-egészség (eredmény)', ok: false, detail: e instanceof Error ? e.message : 'hiba', severity: 'fail' })
  }

  // 3) Data integrity — no encoded (q_) names left in truth tables
  try {
    const [p] = await sql`SELECT COUNT(*)::int n FROM predictions WHERE player LIKE 'q\\_%'`
    const [kv] = await sql`SELECT COUNT(*)::int n FROM imported_rows WHERE table_name IN ('favorites','bonuses') AND payload->>'player' LIKE 'q\\_%'`
    const total = (p.n ?? 0) + (kv.n ?? 0)
    checks.push({
      name: 'Adatintegritás (kódolt nevek)',
      ok: total === 0,
      detail: total === 0 ? 'nincs q_ kódolt játékosnév' : `${total} kódolt név maradt`,
      severity: total === 0 ? 'pass' : 'warn'
    })
  } catch (e) {
    checks.push({ name: 'Adatintegritás (kódolt nevek)', ok: false, detail: e instanceof Error ? e.message : 'hiba', severity: 'warn' })
  }

  // 4) Convex ↔ Neon parity (predictions + results)
  const cvx = await convexState()
  if (cvx) {
    try {
      const cvxPreds = Object.values(cvx.predictions ?? {}).reduce((n: number, m: any) => n + Object.keys(m).length, 0)
      const [np] = await sql`SELECT COUNT(*)::int n FROM predictions WHERE community = 'hu'`
      const predDelta = cvxPreds - (np.n ?? 0)
      checks.push({
        name: 'Convex↔Neon tippek',
        ok: predDelta <= 0,
        detail: predDelta <= 0 ? `szinkronban (${np.n})` : `${predDelta} tipp csak a Convexen`,
        severity: predDelta <= 0 ? 'pass' : 'warn'
      })
      const cvxRes = Object.keys(cvx.results ?? {}).length
      const [nr] = await sql`SELECT COUNT(*)::int n FROM results`
      checks.push({
        name: 'Convex↔Neon eredmények',
        ok: (nr.n ?? 0) >= cvxRes,
        detail: `Neon ${nr.n} · Convex ${cvxRes}`,
        severity: (nr.n ?? 0) >= cvxRes ? 'pass' : 'warn'
      })
    } catch (e) {
      checks.push({ name: 'Convex↔Neon parity', ok: false, detail: e instanceof Error ? e.message : 'hiba', severity: 'warn' })
    }
  } else {
    checks.push({ name: 'Convex↔Neon parity', ok: true, detail: 'Convex nem elérhető (kihagyva)', severity: 'warn' })
  }

  // 5) Live derived-state sanity — rankings never exceed the roster
  try {
    const state = await loadPublicStateFromNeon('hu')
    const roster = state.settings.players?.length ?? 0
    const wiz = state.wizardRankings?.length ?? 0
    const swiss = state.swiss?.standings?.length ?? 0
    const ok = wiz <= roster && swiss <= roster
    checks.push({
      name: 'Származtatott rangsorok',
      ok,
      detail: `játékos ${roster} · wizard ${wiz} · párbaj ${swiss}`,
      severity: ok ? 'pass' : 'warn'
    })
  } catch (e) {
    checks.push({ name: 'Származtatott rangsorok', ok: false, detail: e instanceof Error ? e.message : 'hiba', severity: 'warn' })
  }

  // 6) Auth provisioning
  try {
    const [a] = await sql`SELECT COUNT(*)::int n FROM imported_rows WHERE table_name = 'pinHashes'`
    checks.push({
      name: 'PIN-ek provizionálva',
      ok: (a.n ?? 0) > 0,
      detail: `${a.n} pinHash · (claim-on-first-login aktív)`,
      severity: (a.n ?? 0) > 0 ? 'pass' : 'warn'
    })
  } catch (e) {
    checks.push({ name: 'PIN-ek provizionálva', ok: false, detail: e instanceof Error ? e.message : 'hiba', severity: 'warn' })
  }

  const allPass = checks.every((c) => c.ok)
  return NextResponse.json({ ok: allPass, checks, ts: Date.now() })
}

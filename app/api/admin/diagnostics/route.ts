import { NextResponse } from 'next/server'
import { getSql, loadPublicStateFromNeon } from '@/lib/db'
import { adminGuard } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// One-click admin diagnostics — runs the DB/data-integrity self-tests live and reports
// pass/fail. Mirrors the monitoring scripts (drift, write-health, encoded-name reconciliation)
// so an operator can verify system health from the console without the CLI.

type Check = { name: string; ok: boolean; detail: string; severity: 'pass' | 'warn' | 'fail' }

export async function GET(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  const sql = getSql()
  const checks: Check[] = []
  const SENTINEL = 990099

  // 1) DB connectivity
  try {
    await sql`SELECT 1`
    checks.push({ name: 'Adatbázis kapcsolat', ok: true, detail: 'Neon elérhető', severity: 'pass' })
  } catch (e) {
    checks.push({
      name: 'Adatbázis kapcsolat',
      ok: false,
      detail: e instanceof Error ? e.message : 'hiba',
      severity: 'fail'
    })
    return NextResponse.json({ ok: false, checks, ts: Date.now() })
  }

  // 2) Write-health: sentinel result insert → read → delete
  try {
    await sql`DELETE FROM results WHERE match_id = ${SENTINEL}`
    await sql`INSERT INTO results (match_id, h, a) VALUES (${SENTINEL}, 3, 1) ON CONFLICT (match_id) DO UPDATE SET h=3, a=1`
    const rb = await sql`SELECT h, a FROM results WHERE match_id = ${SENTINEL}`
    await sql`DELETE FROM results WHERE match_id = ${SENTINEL}`
    const ok = rb[0]?.h === 3 && rb[0]?.a === 1
    checks.push({
      name: 'Írás-egészség (eredmény)',
      ok,
      detail: ok ? 'insert → read → delete sikeres' : 'visszaolvasás hibás',
      severity: ok ? 'pass' : 'fail'
    })
  } catch (e) {
    checks.push({
      name: 'Írás-egészség (eredmény)',
      ok: false,
      detail: e instanceof Error ? e.message : 'hiba',
      severity: 'fail'
    })
  }

  // 3) Data integrity — no encoded (q_) names left in truth tables
  try {
    const [p] = await sql`SELECT COUNT(*)::int n FROM predictions WHERE player LIKE 'q\\_%'`
    const [kv] =
      await sql`SELECT COUNT(*)::int n FROM imported_rows WHERE table_name IN ('favorites','bonuses') AND payload->>'player' LIKE 'q\\_%'`
    const total = (p.n ?? 0) + (kv.n ?? 0)
    checks.push({
      name: 'Adatintegritás (kódolt nevek)',
      ok: total === 0,
      detail: total === 0 ? 'nincs q_ kódolt játékosnév' : `${total} kódolt név maradt`,
      severity: total === 0 ? 'pass' : 'warn'
    })
  } catch (e) {
    checks.push({
      name: 'Adatintegritás (kódolt nevek)',
      ok: false,
      detail: e instanceof Error ? e.message : 'hiba',
      severity: 'warn'
    })
  }

  // 4) Live derived-state sanity — rankings never exceed the roster
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
    checks.push({
      name: 'Származtatott rangsorok',
      ok: false,
      detail: e instanceof Error ? e.message : 'hiba',
      severity: 'warn'
    })
  }

  // 5) Auth provisioning
  try {
    const [a] = await sql`SELECT COUNT(*)::int n FROM imported_rows WHERE table_name = 'pinHashes'`
    checks.push({
      name: 'PIN-ek provizionálva',
      ok: (a.n ?? 0) > 0,
      detail: `${a.n} pinHash · (claim-on-first-login aktív)`,
      severity: (a.n ?? 0) > 0 ? 'pass' : 'warn'
    })
  } catch (e) {
    checks.push({
      name: 'PIN-ek provizionálva',
      ok: false,
      detail: e instanceof Error ? e.message : 'hiba',
      severity: 'warn'
    })
  }

  const allPass = checks.every((c) => c.ok)
  return NextResponse.json({ ok: allPass, checks, ts: Date.now() })
}

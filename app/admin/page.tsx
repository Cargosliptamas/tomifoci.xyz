'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MATCHES, flag } from '@/lib/fixtures'
import type { GameState } from '@/lib/types'

type Section =
  | 'dash'
  | 'players'
  | 'results'
  | 'override'
  | 'bonus'
  | 'swiss'
  | 'api'
  | 'log'
  | 'leads'
  | 'backup'
  | 'diag'

type ConfirmConfig = {
  title: string
  body: string
  danger?: boolean
  yes?: string
  onYes: () => void
}

type WriteFn = (path: string, body: unknown, successMsg: string) => void | Promise<void>
type AskFn = (cfg: ConfirmConfig) => void

const NAV: ReadonlyArray<readonly [Section, string, string]> = [
  ['dash', '📊', 'Áttekintés'],
  ['players', '👥', 'Játékosok'],
  ['results', '⚽', 'Eredmények'],
  ['override', '✏️', 'Felülírás'],
  ['bonus', '🎁', 'Bónuszok'],
  ['swiss', '♟', 'Svájci'],
  ['api', '📡', 'LiveScore'],
  ['log', '🧾', 'Napló'],
  ['leads', '📨', 'Érdeklődők'],
  ['backup', '💾', 'Mentés'],
  ['diag', '🔬', 'Diagnosztika']
]

const TITLES: Record<Section, readonly [string, string]> = {
  dash: ['Üzemeltetés', 'Áttekintés'],
  players: ['Közösség', 'Játékosok & ligák'],
  results: ['Játék', 'Eredmények & KO'],
  override: ['Játék', 'Tipp felülírás'],
  bonus: ['Játék', 'Bónuszpontok'],
  swiss: ['Játék', 'Svájci liga — admin'],
  api: ['Integráció', 'LiveScore & API'],
  log: ['Üzemeltetés', 'Tranzakciós napló'],
  leads: ['Közösség', 'Érdeklődők'],
  backup: ['Üzemeltetés', 'Mentés & visszaállítás'],
  diag: ['Üzemeltetés', 'Diagnosztika & önteszt']
}

// ── shared helpers ──────────────────────────────────────────────────────────

async function adminPost(
  path: string,
  token: string,
  session: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/${path}`, {
      method: 'POST',
      headers: adminHeaders(token, session),
      body: JSON.stringify(body)
    })
    const json = (await res.json().catch(() => ({ ok: false, error: 'no-json' }))) as {
      ok?: boolean
      error?: string
    }
    if (json.ok) return { ok: true }
    return { ok: false, error: json.error ?? `http-${res.status}` }
  } catch {
    return { ok: false, error: 'network' }
  }
}

function adminHeaders(token: string, session: string, json = true): Record<string, string> {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-admin-token': token,
    ...(session ? { 'x-admin-session': session } : {})
  }
}

function writeErrorMsg(error?: string): string {
  if (error === 'admin-not-configured') return 'ADMIN_TOKEN nincs beállítva a Vercelben'
  if (error === 'unauthorized') return 'Hibás token'
  if (error === 'totp-required') return '2FA kód szükséges'
  if (error === 'bad-totp') return 'Hibás 2FA kód'
  if (error === 'admin-session-required') return 'Admin session lejárt vagy hiányzik'
  if (error === 'league-exists') return 'Ez a liga már létezik'
  if (error === 'league-not-found') return 'A liga nem található'
  if (error === 'bad-league') return 'Érvénytelen liga név'
  if (error === 'player-not-found') return 'A játékos nem található'
  if (error === 'push-not-configured') return 'Push nincs konfigurálva: VAPID_PUBLIC/VAPID_PRIVATE hiányzik'
  if (error === 'subscriptions-unavailable') return 'Push feliratkozások nem elérhetők'
  return 'Backend még nincs bekötve'
}

function ago(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'most'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `${min} perce`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} órája`
  return `${Math.floor(h / 24)} napja`
}

function fmtTs(ts: number): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── Transaction log ──────────────────────────────────────────────────────────
// Admin writes append to the `txnlog` table, surfaced as `state._txnlog`
// ({[id]: {ts, who, type, label, path}}). GameState doesn't type it, so read it
// defensively. The legacy `swissLog` is the Swiss-engine audit, NOT admin writes —
// so the admin Napló + Dashboard feed must read `_txnlog`, sorted newest-first.
type TxnRow = { ts: number; who?: string; type?: string; label?: string; path?: string }

function txnEntries(state: GameState | null): TxnRow[] {
  const raw = (state as unknown as { _txnlog?: Record<string, TxnRow> } | null)?._txnlog
  if (!raw || typeof raw !== 'object') return []
  return Object.values(raw)
    .filter((r): r is TxnRow => Boolean(r) && typeof r.ts === 'number')
    .sort((a, b) => b.ts - a.ts)
}

// ── page ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [totp, setTotp] = useState('')
  const [adminSession, setAdminSession] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [section, setSection] = useState<Section>('dash')
  const [state, setState] = useState<GameState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null)

  async function loadState() {
    const res = await fetch('/api/state?community=hu', { cache: 'no-store' })
    const json = await res.json()
    if (json.ok) setState(json.state as GameState)
  }
  useEffect(() => {
    if (authed) void loadState()
  }, [authed])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }
  const ask: AskFn = (cfg) => setConfirm(cfg)

  const write: WriteFn = async (path, body, successMsg) => {
    const res = await adminPost(path, token, adminSession, body)
    if (res.ok) {
      await loadState()
      showToast(successMsg)
    } else {
      showToast(writeErrorMsg(res.error))
    }
  }

  async function login() {
    if (!token || authBusy) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, totp })
      })
      const json = (await res.json().catch(() => ({ ok: false, error: 'no-json' }))) as {
        ok?: boolean
        error?: string
        session?: string
      }
      if (json.ok) {
        setAdminSession(json.session ?? '')
        setAuthed(true)
      } else {
        setAuthError(writeErrorMsg(json.error))
      }
    } catch {
      setAuthError('network')
    } finally {
      setAuthBusy(false)
    }
  }

  if (!authed) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-white"
        style={{ background: 'linear-gradient(170deg,#0C4D49,#08363C)' }}
      >
        <div className="w-full max-w-[340px] text-center">
          <div className="mx-auto flex size-[60px] items-center justify-center rounded-[16px] border border-white/20 bg-white/10 text-[28px]">
            🛡️
          </div>
          <div className="mt-[14px] text-[20px] font-black">Admin konzol</div>
          <div className="text-[13px]" style={{ color: '#9fe6dd' }}>
            VB Tippjáték 2026 · üzemeltetés
          </div>
          <div className="mono mt-[10px] text-[11px] tracking-[0.04em] text-white/50">ADMIN_TOKEN + 2FA</div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="mono mt-6 w-full rounded-[12px] border border-white/20 bg-white/10 px-4 py-3 text-center text-white placeholder-white/40 outline-none"
          />
          <input
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="2FA kód, ha be van kapcsolva"
            inputMode="numeric"
            className="mono mt-3 w-full rounded-[12px] border border-white/20 bg-white/10 px-4 py-3 text-center text-white placeholder-white/40 outline-none"
          />
          {authError && <div className="mt-3 text-[12px] font-bold text-[#ffb6b6]">{authError}</div>}
          <button
            onClick={() => void login()}
            disabled={!token || authBusy}
            className="mt-4 w-full rounded-[12px] py-3 text-[14px] font-black disabled:opacity-60"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
          >
            {authBusy ? 'Belépés…' : 'Belépés'}
          </button>
          <div className="mt-4 text-[11px] text-white/40">
            Ha <span className="mono">ADMIN_TOTP_SECRET</span> be van állítva, a 6 jegyű kód is kötelező.
          </div>
        </div>
      </div>
    )
  }

  const [eyebrow, title] = TITLES[section]

  return (
    <div className="min-h-[100dvh] bg-[#EDF2F2]">
      <div className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
        {/* nav */}
        <nav className="flex gap-1.5 overflow-x-auto border-b border-[#E1EAEA] bg-white px-3.5 py-2.5 lg:h-[100dvh] lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:px-3 lg:py-[18px]">
          <div className="mb-2 hidden items-center gap-2 px-3 lg:flex">
            <span
              className="flex size-[30px] items-center justify-center rounded-[9px] text-white"
              style={{ background: 'linear-gradient(160deg,#0C4D49,#0F6A64)' }}
            >
              🛡️
            </span>
            <span className="text-[15px] font-black">Admin</span>
          </div>
          {NAV.map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-[11px] whitespace-nowrap rounded-[11px] px-[13px] py-[10px] text-left ${
                section === id ? 'bg-[#EBF6F5] font-black text-[#007E73]' : 'font-bold text-[#11302E]/65'
              }`}
            >
              <span className="w-[20px] text-center text-[16px]">{icon}</span>
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* main */}
        <main className="px-[18px] py-[18px] lg:px-[30px] lg:py-[26px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow tracking-[0.12em] text-[#11302E]/50">{eyebrow}</div>
              <h1 className="text-[23px] font-black">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="mono rounded-[7px] border border-[#c2e6cf] bg-[#e4f5ea] px-[9px] py-[5px] text-[10px] font-bold text-[#15803d]">
                ● ÉLES
              </span>
              <span className="flex items-center gap-[7px] rounded-full border border-[#E1EAEA] bg-white py-1 pl-3 pr-[5px]">
                <span className="text-[12px] font-extrabold">Tomi</span>
                <span className="rounded-full bg-[#fff3d6] px-[7px] py-[2px] text-[9px] font-extrabold text-[#9a6b00]">
                  FŐADMIN
                </span>
                <button
                  onClick={() => {
                    setAuthed(false)
                    setToken('')
                    setTotp('')
                    setAdminSession('')
                    setSection('dash')
                  }}
                  className="flex size-[26px] items-center justify-center rounded-full bg-[#f1f5f5] text-[13px]"
                  title="Kilépés"
                >
                  ⏏
                </button>
              </span>
            </div>
          </div>

          <div className="animate-in">
            {section === 'dash' && (
              <Dashboard
                state={state}
                onRecompute={() => void loadState().then(() => showToast('✓ Állapot frissítve'))}
              />
            )}
            {section === 'players' && <Players state={state} ask={ask} write={write} showToast={showToast} />}
            {section === 'results' && (
              <Results
                token={token}
                adminSession={adminSession}
                state={state}
                onSaved={(m) => void loadState().then(() => showToast(m))}
              />
            )}
            {section === 'override' && <Override state={state} ask={ask} write={write} />}
            {section === 'bonus' && <Bonuses state={state} ask={ask} write={write} />}
            {section === 'swiss' && <Swiss state={state} ask={ask} write={write} />}
            {section === 'api' && <ApiSection state={state} ask={ask} write={write} showToast={showToast} />}
            {section === 'log' && <LogSection state={state} ask={ask} write={write} showToast={showToast} />}
            {section === 'leads' && <Leads token={token} adminSession={adminSession} showToast={showToast} />}
            {section === 'backup' && (
              <Backup
                token={token}
                adminSession={adminSession}
                ask={ask}
                showToast={showToast}
                onApplied={() =>
                  void loadState().then(() => showToast('✓ Állapot visszaállítva mentésből · naplózva'))
                }
              />
            )}
            {section === 'diag' && <Diagnostics token={token} adminSession={adminSession} />}
          </div>
        </main>
      </div>

      {confirm && (
        <div
          onClick={() => setConfirm(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          style={{ background: 'rgba(8,54,60,.5)', backdropFilter: 'blur(3px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[18px] bg-white p-[22px] shadow-[0_24px_60px_rgba(8,54,60,0.4)]"
          >
            <div className="mb-2 text-[18px] font-black">{confirm.title}</div>
            <div className="mb-5 text-[14px] leading-[1.5] text-[#11302E]/70">{confirm.body}</div>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-[11px] border border-[#E1EAEA] bg-white px-[18px] py-[11px] text-[14px] font-bold text-[#11302E]"
              >
                Mégse
              </button>
              <button
                onClick={() => {
                  const c = confirm
                  setConfirm(null)
                  c.onYes()
                }}
                className="rounded-[11px] px-[18px] py-[11px] text-[14px] font-extrabold text-white"
                style={
                  confirm.danger
                    ? { background: '#E5484D' }
                    : { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }
                }
              >
                {confirm.yes ?? 'Megerősítés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[70] -translate-x-1/2 rounded-[12px] bg-[#11302E] px-5 py-3 text-[13px] font-bold text-white shadow-[0_12px_30px_rgba(8,54,60,0.4)]">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── DASHBOARD (existing — unchanged behaviour) ──────────────────────────────

function Dashboard({ state, onRecompute }: { state: GameState | null; onRecompute: () => void }) {
  const players = state?.settings.players?.length ?? 0
  const predictions = state
    ? Object.values(state.predictions).reduce((n, m) => n + Object.keys(m).length, 0)
    : 0
  const results = state ? Object.keys(state.results).length : 0
  const round = state?.swiss?.round
  const log = txnEntries(state)

  return (
    <>
      <div className="mb-[18px] grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Játékosok" value={players} />
        <Tile label="Tippek" value={predictions} />
        <Tile label="Eredmények" value={results} suffix="/104" />
        <Tile label="Aktív kör" value={round ? `♟ ${round}.` : '—'} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="rounded-[16px] border border-[#E1EAEA] bg-white p-4">
          <div className="text-xs font-black tracking-[0.08em] text-[#11302E]/55">RENDSZERÁLLAPOT</div>
          <Status
            label="Adatbázis (Neon)"
            ok={Boolean(state)}
            value={state ? 'kapcsolódva' : 'nincs kapcsolat'}
          />
          <Status label="Pontok forrása" ok value="élő újraszámítás" />
          <Status label="Svájci forduló" ok={Boolean(round)} value={round ? `${round}. forduló` : '—'} />
          <button
            onClick={onRecompute}
            className="mt-3.5 w-full rounded-[11px] border border-[#cfe0de] bg-[#f6faf9] py-2.5 text-[13px] font-extrabold text-[#007E73]"
          >
            ⟳ Pontok teljes újraszámítása
          </button>
          <div className="mono mt-2 text-[11px] text-[#11302E]/50">
            A pontok és rangsorok minden olvasáskor élőben számolódnak a tippekből és eredményekből.
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E1EAEA] bg-white p-4">
          <div className="mb-3 text-xs font-black tracking-[0.08em] text-[#11302E]/55">NAPLÓ · LEGUTÓBBI</div>
          {log.length === 0 ? (
            <div className="text-[13px] text-[#11302E]/50">Nincs naplóbejegyzés.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {log.slice(0, 5).map((l, i) => (
                <div key={i} className="flex items-baseline gap-2.5">
                  <span className="mono whitespace-nowrap text-[10px] text-[#11302E]/45">{fmtTs(l.ts)}</span>
                  <span className="text-[13px] font-semibold text-[#11302E]">{l.label ?? '—'}</span>
                  {l.who && <span className="text-[11px] text-[#11302E]/40">· {l.who}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── PLAYERS ─────────────────────────────────────────────────────────────────

function Players({
  state,
  ask,
  write,
  showToast
}: {
  state: GameState | null
  ask: AskFn
  write: WriteFn
  showToast: (m: string) => void
}) {
  const [search, setSearch] = useState('')
  const players = state?.settings.players ?? []
  const leagues = state?.settings.leagues?.length ? state.settings.leagues : ['Mindenki']
  const q = search.toLowerCase()
  const list = players.filter((p) => !q || p.name.toLowerCase().includes(q))

  return (
    <>
      <LeagueManager leagues={leagues} players={players} ask={ask} write={write} />

      <div className="mb-4 flex flex-wrap gap-2.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Játékos keresése…"
          className="min-w-[180px] flex-1 rounded-[11px] border border-[#E1EAEA] bg-white px-[14px] py-[11px] text-[14px] outline-none"
        />
        <button
          onClick={() => void write('players', { action: 'create' }, '✓ Játékos hozzáadva · naplózva')}
          className="rounded-[11px] px-[18px] py-[11px] text-[14px] font-extrabold"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          + Új játékos
        </button>
      </div>

      <div className="mb-5 overflow-hidden rounded-[16px] border border-[#E1EAEA] bg-white">
        <div className="flex border-b border-[#EEF3F3] px-4 py-2.5 text-[11px] font-black tracking-[0.06em] text-[#11302E]/45">
          <span className="flex-1">JÁTÉKOS</span>
          <span className="w-[180px]">LIGÁK</span>
          <span className="w-[192px] text-right">MŰVELET</span>
        </div>
        {list.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-[#11302E]/50">
            {state ? 'Nincs a keresésnek megfelelő játékos.' : 'Betöltés…'}
          </div>
        ) : (
          list.map((p) => (
            <div
              key={p.name}
              className="flex items-center border-b border-[#F1F5F5] px-4 py-[11px] last:border-b-0"
            >
              <span className="flex flex-1 items-center gap-2.5">
                <span className="flex size-[30px] items-center justify-center rounded-full bg-[#EBF6F5] text-[12px] font-black text-[#007E73]">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[14px] font-bold">{p.name}</span>
              </span>
              <span
                className="w-[180px] truncate text-[12px] font-semibold text-[#11302E]/60"
                title={(p.leagues ?? []).join(', ')}
              >
                {p.leagues?.length ? p.leagues.join(', ') : '—'}
              </span>
              <span className="flex w-[192px] justify-end gap-1.5">
                <button
                  onClick={() => {
                    const available = leagues.filter((league) => league !== 'Mindenki')
                    const answer = window.prompt(
                      `Ligák vesszővel (${p.name})\nElérhető: ${available.join(', ') || 'nincs'}`,
                      (p.leagues ?? []).join(', ')
                    )
                    if (answer == null) return
                    void write(
                      'players',
                      { action: 'setLeagues', name: p.name, leagues: parseLeagueInput(answer) },
                      `✓ Ligák frissítve — ${p.name} · naplózva`
                    )
                  }}
                  className="rounded-[8px] border border-[#E1EAEA] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#11302E]"
                  title="Ligák szerkesztése"
                >
                  🏷
                </button>
                <button
                  onClick={() => {
                    const newName = window.prompt(`Új név (jelenlegi: ${p.name})`, p.name)?.trim()
                    if (!newName || newName === p.name) return
                    void write(
                      'players',
                      { action: 'rename', oldName: p.name, newName },
                      `✓ Átnevezve — ${p.name} → ${newName} · naplózva`
                    )
                  }}
                  className="rounded-[8px] border border-[#E1EAEA] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#11302E]"
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    const pin = window.prompt(`Új 4 jegyű PIN (${p.name})`, '')?.trim()
                    if (!pin) return
                    if (!/^\d{4}$/.test(pin)) {
                      showToast('A PIN 4 számjegy legyen')
                      return
                    }
                    void write(
                      'players',
                      { action: 'setPin', name: p.name, pin },
                      `✓ PIN frissítve — ${p.name} · naplózva`
                    )
                  }}
                  className="rounded-[8px] border border-[#E1EAEA] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#11302E]"
                  title="PIN reset"
                >
                  🔑
                </button>
                <button
                  onClick={() =>
                    ask({
                      title: 'Játékos törlése?',
                      body: `„${p.name}” archiválásra kerül és 10 napig visszaállítható. A tippjei és származtatott pontjai eltávolításra kerülnek a rangsorból.`,
                      danger: true,
                      yes: 'Archiválás',
                      onYes: () =>
                        void write(
                          'players',
                          { action: 'delete', name: p.name },
                          `✓ Játékos archiválva — ${p.name} · naplózva`
                        )
                    })
                  }
                  className="rounded-[8px] border border-[#f3d2cf] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#E5484D]"
                >
                  🗑
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mb-2.5 text-xs font-black tracking-[0.08em] text-[#11302E]/55">
        🗄 TÖRÖLT JÁTÉKOSOK{' '}
        <span className="font-bold text-[#11302E]/40">· 10 napos visszaállítási ablak</span>
      </div>
      <RestoreDeletedPlayer write={write} />
    </>
  )
}

function LeagueManager({
  leagues,
  players,
  ask,
  write
}: {
  leagues: string[]
  players: Array<{ name: string; leagues?: string[] }>
  ask: AskFn
  write: WriteFn
}) {
  const [newLeague, setNewLeague] = useState('')
  const normalized = ['Mindenki', ...leagues.filter((league) => league && league !== 'Mindenki')]

  return (
    <div className="mb-4 rounded-[16px] border border-[#E1EAEA] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black tracking-[0.08em] text-[#11302E]/55">LIGÁK</div>
          <div className="mt-0.5 text-[13px] text-[#11302E]/55">
            {normalized.length} liga · tagság a játékos sorában szerkeszthető
          </div>
        </div>
        <div className="flex min-w-[240px] flex-1 justify-end gap-2">
          <input
            value={newLeague}
            onChange={(e) => setNewLeague(e.target.value)}
            placeholder="Új liga neve…"
            className="min-w-[140px] flex-1 rounded-[10px] border border-[#E1EAEA] px-3 py-2 text-[13px] outline-none"
          />
          <button
            onClick={() => {
              const league = newLeague.trim()
              if (!league) return
              void write(
                'players',
                { action: 'createLeague', league },
                `✓ Liga létrehozva — ${league} · naplózva`
              )
              setNewLeague('')
            }}
            disabled={!newLeague.trim()}
            className="rounded-[10px] px-3.5 py-2 text-[13px] font-extrabold disabled:opacity-50"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
          >
            + Liga
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {normalized.map((league) => {
          const isGlobal = league === 'Mindenki'
          const memberCount = isGlobal
            ? players.length
            : players.filter((p) => p.leagues?.includes(league)).length
          return (
            <div key={league} className="rounded-[12px] border border-[#EEF3F3] bg-[#f8fbfb] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-black">{league}</span>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#11302E]/55">
                  {memberCount} fő
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {isGlobal ? (
                  <span className="rounded-[8px] bg-[#EBF6F5] px-2.5 py-1.5 text-[11px] font-bold text-[#007E73]">
                    alapliga
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        const next = window.prompt(`Új liga név (${league})`, league)?.trim()
                        if (!next || next === league) return
                        void write(
                          'players',
                          { action: 'renameLeague', oldLeague: league, newLeague: next },
                          `✓ Liga átnevezve — ${league} → ${next} · naplózva`
                        )
                      }}
                      className="rounded-[8px] border border-[#E1EAEA] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#11302E]"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() =>
                        ask({
                          title: 'Liga törlése?',
                          body: `„${league}” törlődik a liga listából és minden játékos tagságából. A játékosok és tippjeik megmaradnak.`,
                          danger: true,
                          yes: 'Liga törlése',
                          onYes: () =>
                            void write(
                              'players',
                              { action: 'deleteLeague', league },
                              `✓ Liga törölve — ${league} · naplózva`
                            )
                        })
                      }
                      className="rounded-[8px] border border-[#f3d2cf] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#E5484D]"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function parseLeagueInput(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

// Deleted players aren't surfaced in the public state, so restore is by name: the
// admin types the archived name and the players route looks up the snapshot
// (10-day window) and re-inserts the cascade.
function RestoreDeletedPlayer({ write }: { write: WriteFn }) {
  const [name, setName] = useState('')
  return (
    <div className="rounded-[16px] border border-[#E1EAEA] bg-white p-4">
      <div className="mb-2.5 text-[13px] text-[#11302E]/60">
        Egy archivált játékos visszaállításához add meg a pontos nevét. A visszaállítás csak a 10 napos
        ablakon belül lehetséges.
      </div>
      <div className="flex flex-wrap gap-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Törölt játékos neve…"
          className="min-w-[180px] flex-1 rounded-[11px] border border-[#E1EAEA] bg-white px-[14px] py-[11px] text-[14px] outline-none"
        />
        <button
          onClick={() => {
            const n = name.trim()
            if (!n) return
            void write('players', { action: 'restore', name: n }, `✓ Játékos visszaállítva — ${n} · naplózva`)
            setName('')
          }}
          disabled={!name.trim()}
          className="rounded-[11px] px-[18px] py-[11px] text-[14px] font-extrabold disabled:opacity-50"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          ♻️ Visszaállítás
        </button>
      </div>
    </div>
  )
}

// ── RESULTS (existing — unchanged behaviour) ────────────────────────────────

function Results({
  token,
  adminSession,
  state,
  onSaved
}: {
  token: string
  adminSession: string
  state: GameState | null
  onSaved: (msg: string) => void
}) {
  const [search, setSearch] = useState('')
  const list = useMemo(() => {
    const q = search.toLowerCase()
    return MATCHES.filter(
      (m) => !q || m.home.toLowerCase().includes(q) || m.away.toLowerCase().includes(q) || String(m.id) === q
    ).slice(0, 60)
  }, [search])

  return (
    <>
      <div className="mb-4 rounded-[12px] border border-[#d3e6e4] bg-[#eef6f6] px-[15px] py-3 text-[13px] text-[#11302E]">
        ⚠️ Eredmény mentése azonnal újraszámolja az érintett pontokat. A mentés <b>upsert</b> — nincs tömeges
        felülírás.
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Mérkőzés keresése (csapat vagy #id)…"
        className="mb-3 w-full rounded-[11px] border border-[#E1EAEA] bg-white px-[14px] py-[11px] text-[14px] outline-none"
      />
      <div className="flex flex-col gap-3">
        {list.map((m) => (
          <ResultRow key={m.id} token={token} adminSession={adminSession} fixture={m} onSaved={onSaved} />
        ))}
      </div>

      <div className="mb-2.5 mt-[22px] text-xs font-black tracking-[0.08em] text-[#11302E]/55">
        🏆 KIESÉSES PÁROSÍTÁSOK (KO)
      </div>
      <div className="rounded-[14px] border border-[#E1EAEA] bg-white p-[15px] text-[13px] text-[#11302E]/70">
        A KO-helyek a csoporteredményekből <b>automatikusan</b> származnak (bracket.autoUpdateBracket). Kézi
        felülírás csak vészhelyzetben — minden manuális slot jelölve lesz.
      </div>
      <KoTeamsEditor token={token} adminSession={adminSession} state={state} onSaved={onSaved} />
    </>
  )
}

function KoTeamsEditor({
  token,
  adminSession,
  state,
  onSaved
}: {
  token: string
  adminSession: string
  state: GameState | null
  onSaved: (msg: string) => void
}) {
  const koMatches = useMemo(() => MATCHES.filter((m) => m.id >= 73), [])
  const [matchId, setMatchId] = useState(koMatches[0]?.id ?? 73)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [confirmed, setConfirmed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const current = state?.koTeams[String(matchId)]
  const fixture = koMatches.find((m) => m.id === matchId)

  useEffect(() => {
    setHome(current?.home ?? '')
    setAway(current?.away ?? '')
    setConfirmed(current?.confirmed !== false)
  }, [matchId, current?.home, current?.away, current?.confirmed])

  async function send(action: 'save' | 'clear') {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/koteams', {
        method: 'POST',
        headers: adminHeaders(token, adminSession),
        body: JSON.stringify(
          action === 'clear' ? { matchId, action: 'clear' } : { matchId, home, away, confirmed }
        )
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (json.ok) {
        onSaved(
          action === 'clear'
            ? `✓ KO párosítás törölve — #${matchId} · naplózva`
            : `✓ KO párosítás mentve — #${matchId} · naplózva`
        )
      } else {
        setErr(writeErrorMsg(json.error))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3.5 rounded-[16px] border border-[#E1EAEA] bg-white p-4">
      <div className="mb-3 text-xs font-black tracking-[0.08em] text-[#11302E]/55">KO KÉZI PÁROSÍTÁS</div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_auto] lg:items-end">
        <label className="text-[12px] font-extrabold text-[#11302E]/60">
          Meccs
          <select
            value={matchId}
            onChange={(e) => setMatchId(Number(e.target.value))}
            className="mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] bg-white px-[13px] py-[11px] text-[14px] font-semibold"
          >
            {koMatches.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} · {m.label ?? 'KO'} · {m.home} – {m.away}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-extrabold text-[#11302E]/60">
          Hazai
          <input
            value={home}
            onChange={(e) => setHome(e.target.value)}
            placeholder={fixture?.home ?? 'Hazai'}
            className="mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] px-[13px] py-[11px] text-[14px]"
          />
        </label>
        <label className="text-[12px] font-extrabold text-[#11302E]/60">
          Vendég
          <input
            value={away}
            onChange={(e) => setAway(e.target.value)}
            placeholder={fixture?.away ?? 'Vendég'}
            className="mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] px-[13px] py-[11px] text-[14px]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void send('save')}
            disabled={busy || !home.trim() || !away.trim()}
            className="rounded-[11px] px-4 py-[11px] text-[13px] font-black disabled:opacity-50"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
          >
            Mentés
          </button>
          <button
            onClick={() => void send('clear')}
            disabled={busy}
            className="rounded-[11px] border border-[#f3d2cf] bg-white px-3.5 py-[11px] text-[13px] font-bold text-[#E5484D]"
          >
            Törlés
          </button>
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12px] font-bold text-[#11302E]/65">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="size-[16px]"
        />
        Admin által megerősített párosítás
      </label>
      {current?.home && current?.away && (
        <div className="mt-2 text-[12px] text-[#11302E]/55">
          Élő érték: {flag(current.home)} {current.home} – {current.away} {flag(current.away)}
        </div>
      )}
      {err && <div className="mt-2 text-[12px] font-bold text-[#E5484D]">{err}</div>}
    </div>
  )
}

function ResultRow({
  token,
  adminSession,
  fixture,
  onSaved
}: {
  token: string
  adminSession: string
  fixture: { id: number; home: string; away: string }
  onSaved: (msg: string) => void
}) {
  const [h, setH] = useState(0)
  const [a, setA] = useState(0)
  const [penH, setPenH] = useState(0)
  const [penA, setPenA] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const isKo = fixture.id >= 73

  async function send(action: 'save' | 'clear') {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/result', {
        method: 'POST',
        headers: adminHeaders(token, adminSession),
        body: JSON.stringify(
          isKo ? { matchId: fixture.id, h, a, penH, penA, action } : { matchId: fixture.id, h, a, action }
        )
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok)
        onSaved(
          action === 'clear'
            ? `✓ Eredmény törölve — #${fixture.id} · naplózva`
            : `✓ Eredmény mentve — #${fixture.id} · ${h}:${a}`
        )
      else
        setErr(
          json.error === 'admin-not-configured'
            ? 'ADMIN_TOKEN nincs beállítva a Vercelben'
            : writeErrorMsg(json.error)
        )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-[#E1EAEA] bg-white px-[15px] py-[13px]">
      <span className="mono w-[42px] text-[11px] text-[#11302E]/50">#{fixture.id}</span>
      <span className="min-w-[150px] flex-1 text-[14px] font-bold">
        {flag(fixture.home)} {fixture.home} – {fixture.away} {flag(fixture.away)}
      </span>
      <div className="flex items-center gap-2">
        <Step value={h} set={setH} />
        <span className="text-[18px] font-black text-[#11302E]/40">:</span>
        <Step value={a} set={setA} />
      </div>
      {isKo && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[#E1EAEA] bg-[#f6faf9] px-2.5 py-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#11302E]/45">
            11-esek
          </span>
          <Step value={penH} set={setPenH} />
          <span className="text-[16px] font-black text-[#11302E]/40">:</span>
          <Step value={penA} set={setPenA} />
        </div>
      )}
      <button
        onClick={() => send('save')}
        disabled={busy}
        className="rounded-[10px] px-4 py-[9px] text-[13px] font-extrabold"
        style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
      >
        Mentés
      </button>
      <button
        onClick={() => send('clear')}
        disabled={busy}
        className="rounded-[10px] border border-[#f3d2cf] bg-white px-3.5 py-[9px] text-[13px] font-bold text-[#E5484D]"
      >
        Törlés
      </button>
      {err && <span className="w-full text-[12px] font-bold text-[#E5484D]">{err}</span>}
    </div>
  )
}

// ── OVERRIDE ────────────────────────────────────────────────────────────────

function Override({ state, ask, write }: { state: GameState | null; ask: AskFn; write: WriteFn }) {
  const players = state?.settings.players ?? []
  const [player, setPlayer] = useState('')
  const [matchId, setMatchId] = useState<number>(MATCHES[0]?.id ?? 0)
  const [h, setH] = useState(0)
  const [a, setA] = useState(0)

  const selectedPlayer = player || players[0]?.name || ''

  return (
    <div className="max-w-[520px]">
      <div className="mb-4 rounded-[12px] border border-[#f3d9a6] bg-[#fff7e6] px-[15px] py-3 text-[13px] text-[#92600c]">
        Egy játékos tippjének felülírása érzékeny művelet — naplózásra kerül és újraszámolja a pontokat (a
        Wizard-tükrözést is). Csak indokolt esetben.
      </div>
      <div className="rounded-[16px] border border-[#E1EAEA] bg-white p-[18px]">
        <label className="text-[12px] font-extrabold text-[#11302E]/60">Játékos</label>
        <select
          value={selectedPlayer}
          onChange={(e) => setPlayer(e.target.value)}
          className="mb-3.5 mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] bg-white px-[13px] py-[11px] text-[14px]"
        >
          {players.length === 0 && <option value="">Nincs játékos</option>}
          {players.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="text-[12px] font-extrabold text-[#11302E]/60">Mérkőzés</label>
        <select
          value={matchId}
          onChange={(e) => setMatchId(Number(e.target.value))}
          className="mb-3.5 mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] bg-white px-[13px] py-[11px] text-[14px]"
        >
          {MATCHES.map((m) => (
            <option key={m.id} value={m.id}>
              #{m.id} · {m.home} – {m.away}
            </option>
          ))}
        </select>

        <label className="text-[12px] font-extrabold text-[#11302E]/60">Új tipp</label>
        <div className="mt-2 flex items-center gap-2.5">
          <Step value={h} set={setH} />
          <span className="text-[18px] font-black text-[#11302E]/35">:</span>
          <Step value={a} set={setA} />
        </div>

        <button
          onClick={() =>
            ask({
              title: 'Tipp felülírása?',
              body: `A(z) „${selectedPlayer}” tippje a #${matchId} mérkőzésen ${h}:${a} értékre íródik felül, naplózásra kerül, és a pontok (a Wizard-tükrözéssel együtt) újraszámolódnak.`,
              yes: 'Felülírás',
              onYes: () =>
                void write(
                  'override',
                  { player: selectedPlayer, matchId, h, a },
                  `✓ Tipp felülírva — ${selectedPlayer} · #${matchId} · naplózva`
                )
            })
          }
          disabled={!selectedPlayer}
          className="mt-[18px] w-full rounded-[12px] py-[13px] text-[14px] font-black disabled:opacity-50"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          Felülírás mentése · naplózva
        </button>
      </div>
    </div>
  )
}

// ── BONUSES ─────────────────────────────────────────────────────────────────

function Bonuses({ state, ask, write }: { state: GameState | null; ask: AskFn; write: WriteFn }) {
  const players = state?.settings.players ?? []
  const [player, setPlayer] = useState('')
  const [pts, setPts] = useState('3')
  const [reason, setReason] = useState('')

  const selectedPlayer = player || players[0]?.name || ''

  const bonusList: { name: string; pts: number; reason: string; idx: number }[] = []
  Object.entries(state?.bonuses ?? {}).forEach(([name, arr]) => {
    arr.forEach((b, i) => bonusList.push({ name, pts: b.pts, reason: b.reason, idx: i }))
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[16px] border border-[#E1EAEA] bg-white p-[18px]">
        <div className="mb-3.5 text-xs font-black tracking-[0.08em] text-[#11302E]/55">BÓNUSZ ADÁSA</div>
        <label className="text-[12px] font-extrabold text-[#11302E]/60">Játékos</label>
        <select
          value={selectedPlayer}
          onChange={(e) => setPlayer(e.target.value)}
          className="mb-3 mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] bg-white px-[13px] py-[11px] text-[14px]"
        >
          {players.length === 0 && <option value="">Nincs játékos</option>}
          {players.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <label className="text-[12px] font-extrabold text-[#11302E]/60">Pont</label>
            <input
              value={pts}
              onChange={(e) => setPts(e.target.value)}
              inputMode="numeric"
              className="mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] px-[13px] py-[11px] text-[16px] font-black"
            />
          </div>
          <div className="flex-[2]">
            <label className="text-[12px] font-extrabold text-[#11302E]/60">Indok</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Továbbjutási bónusz"
              className="mt-1.5 w-full rounded-[11px] border border-[#E1EAEA] px-[13px] py-[11px] text-[14px]"
            />
          </div>
        </div>
        <button
          onClick={() => {
            const n = Number(pts)
            void write(
              'bonus',
              { action: 'award', player: selectedPlayer, pts: n, reason: reason || 'Bónusz' },
              `✓ Bónusz jóváírva — ${selectedPlayer} ${n >= 0 ? '+' : ''}${n} · naplózva`
            )
          }}
          disabled={!selectedPlayer}
          className="mt-4 w-full rounded-[12px] py-3 text-[14px] font-black disabled:opacity-50"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          🎁 Bónusz jóváírása
        </button>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#E1EAEA] bg-white">
        <div className="px-4 pb-2.5 pt-3.5 text-xs font-black tracking-[0.08em] text-[#11302E]/55">
          LEGUTÓBBI BÓNUSZOK
        </div>
        {bonusList.length === 0 ? (
          <div className="px-4 pb-5 text-[13px] text-[#11302E]/50">Nincs rögzített bónusz.</div>
        ) : (
          bonusList.map((b) => (
            <div
              key={`${b.name}-${b.idx}`}
              className="flex items-center border-t border-[#F1F5F5] px-4 py-[11px]"
            >
              <div className="flex-1">
                <div className="text-[14px] font-bold">
                  {b.name}{' '}
                  <span className="font-black text-[#15803d]">{b.pts >= 0 ? `+${b.pts}` : b.pts}</span>
                </div>
                <div className="text-[12px] text-[#11302E]/55">{b.reason}</div>
              </div>
              <button
                onClick={() =>
                  ask({
                    title: 'Bónusz visszavonása?',
                    body: `A(z) „${b.name}” ${b.pts >= 0 ? '+' : ''}${b.pts} bónusza eltávolításra kerül és a játékos pontszáma csökken.`,
                    danger: true,
                    yes: 'Visszavonás',
                    onYes: () =>
                      void write(
                        'bonus',
                        { action: 'remove', player: b.name, index: b.idx },
                        `✓ Bónusz visszavonva — ${b.name} · naplózva`
                      )
                  })
                }
                className="rounded-[9px] border border-[#f3d2cf] bg-white px-3 py-1.5 text-[12px] font-bold text-[#E5484D]"
              >
                Visszavonás
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── SWISS ───────────────────────────────────────────────────────────────────

function Swiss({ state, ask, write }: { state: GameState | null; ask: AskFn; write: WriteFn }) {
  const round = state?.swiss?.round ?? 1
  const frozen = state?.swiss?.frozen ?? false
  const pairings = (state?.swissPairings ?? []).filter((p) => p.round === round)
  const profiles = state?.swissProfiles ?? []
  const activeProfiles = profiles.filter((p) => p.active !== false && p.removedAtRound == null)
  const [addName, setAddName] = useState('')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#E1EAEA] bg-white px-4 py-3.5">
        <span className="text-[14px] font-extrabold">Forduló:</span>
        <span className="rounded-[9px] bg-[#EBF6F5] px-3.5 py-1.5 text-[14px] font-black text-[#007E73]">
          {round}. forduló
        </span>
        <span className="flex-1 text-[12px] text-[#11302E]/55">
          Állapot:{' '}
          <b className={frozen ? 'text-[#92600c]' : 'text-[#15803d]'}>{frozen ? 'befagyasztva' : 'aktív'}</b>{' '}
          · a standings a 10. forduló után fagy be
        </span>
        <button
          onClick={() =>
            ask({
              title: 'Forduló újrasorsolása?',
              body: `A(z) ${round}. forduló párosításai újragenerálódnak és minden származtatott állapot újraszámolódik. A művelet naplózásra kerül.`,
              danger: true,
              yes: 'Újrasorsolás',
              onYes: () =>
                void write(
                  'swiss',
                  { action: 'reshuffle', round },
                  `✓ ${round}. forduló újrasorsolva · naplózva`
                )
            })
          }
          className="rounded-[10px] border border-[#f3d9a6] bg-[#fff7e6] px-3.5 py-2 text-[13px] font-extrabold text-[#92600c]"
        >
          ⟲ Újrasorsolás
        </button>
      </div>

      <div className="mb-4 overflow-hidden rounded-[16px] border border-[#E1EAEA] bg-white">
        <div className="flex justify-between border-b border-[#EEF3F3] px-4 py-2.5 text-[11px] font-black tracking-[0.06em] text-[#11302E]/45">
          <span>JAVASOLT PÁROSÍTÁSOK</span>
          <span>{round}. FORDULÓ</span>
        </div>
        {pairings.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-[#11302E]/50">
            {state ? 'Nincs párosítás ehhez a fordulóhoz.' : 'Betöltés…'}
          </div>
        ) : (
          pairings.map((p, i) => (
            <div key={i} className="flex items-center border-b border-[#F1F5F5] px-4 py-3 last:border-b-0">
              <span className="flex-1 text-right text-[14px] font-bold">{p.a}</span>
              <span className="mx-3.5 text-[11px] font-black text-[#11302E]/35">VS</span>
              <span className="flex-1 text-[14px] font-bold">{p.b}</span>
            </div>
          ))
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <button
          onClick={() =>
            void write(
              'swiss',
              { action: 'publish', round },
              `✓ ${round}. forduló párosítás publikálva · naplózva`
            )
          }
          className="rounded-[12px] px-[22px] py-3 text-[14px] font-black"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          ✓ Párosítás publikálása
        </button>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#E1EAEA] bg-white">
        <div className="px-4 pb-2 pt-3.5 text-[11px] font-black tracking-[0.06em] text-[#11302E]/45">
          LIGA TAGOK · {round}. FORDULÓ
        </div>
        <div className="flex flex-wrap gap-2.5 px-4 pb-3.5">
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Játékos neve…"
            className="min-w-[160px] flex-1 rounded-[11px] border border-[#E1EAEA] bg-white px-[14px] py-[11px] text-[14px] outline-none"
          />
          <button
            onClick={() => {
              const n = addName.trim()
              if (!n) return
              void write(
                'swiss',
                { action: 'add', player: n, round },
                `✓ Játékos hozzáadva a ligához — ${n} · naplózva`
              )
              setAddName('')
            }}
            disabled={!addName.trim()}
            className="rounded-[11px] px-[18px] py-[11px] text-[14px] font-extrabold disabled:opacity-50"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
          >
            + Hozzáadás
          </button>
        </div>
        {activeProfiles.length === 0 ? (
          <div className="border-t border-[#F1F5F5] px-4 py-5 text-center text-[13px] text-[#11302E]/50">
            {state ? 'Nincs aktív liga tag.' : 'Betöltés…'}
          </div>
        ) : (
          activeProfiles.map((p) => (
            <div key={p.player} className="flex items-center border-t border-[#F1F5F5] px-4 py-[11px]">
              <span className="flex-1 text-[14px] font-bold">{p.player}</span>
              <button
                onClick={() =>
                  ask({
                    title: 'Játékos eltávolítása?',
                    body: `„${p.player}” kikerül a Svájci ligából a(z) ${round}. fordulótól. Az ellenfelei bye-t kapnak. A művelet naplózásra kerül.`,
                    danger: true,
                    yes: 'Eltávolítás',
                    onYes: () =>
                      void write(
                        'swiss',
                        { action: 'remove', player: p.player, round },
                        `✓ Játékos eltávolítva — ${p.player} · naplózva`
                      )
                  })
                }
                className="rounded-[9px] border border-[#f3d2cf] bg-white px-3 py-1.5 text-[12px] font-bold text-[#E5484D]"
              >
                Eltávolítás
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// ── API / LIVESCORE ─────────────────────────────────────────────────────────

function ApiSection({
  state,
  ask,
  write,
  showToast
}: {
  state: GameState | null
  ask: AskFn
  write: WriteFn
  showToast: (m: string) => void
}) {
  const [emergency, setEmergency] = useState(false)
  const cache = state?.apiCache ?? {}
  const entries = Object.entries(cache)
  const lastTs = entries.length ? Math.max(...entries.map(([, v]) => v.ts)) : null
  const healthy = lastTs != null && Date.now() - lastTs < 10 * 60_000

  return (
    <>
      <div className="mb-[18px] grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="API állapot" value={lastTs == null ? '—' : healthy ? '● Egészséges' : '● Régi'} />
        <Tile label="Utolsó poll" value={lastTs == null ? '—' : ago(lastTs)} />
        <Tile label="Cache kulcsok" value={entries.length} />
        <Tile label="DB kapcsolat" value={state ? '✓' : '—'} />
      </div>

      <div className="mb-4 rounded-[16px] border border-[#E1EAEA] bg-white p-4">
        <div className="mb-3 text-xs font-black tracking-[0.08em] text-[#11302E]/55">CACHE FRISSESSÉG</div>
        {entries.length === 0 ? (
          <div className="text-[13px] text-[#11302E]/50">Nincs cache-elt API-adat.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {entries
              .sort((a, b) => b[1].ts - a[1].ts)
              .slice(0, 8)
              .map(([key, v]) => {
                const fresh = Date.now() - v.ts < 5 * 60_000
                return (
                  <div key={key} className="rounded-[10px] bg-[#f6faf9] px-3 py-2.5">
                    <div className="truncate text-[12px] font-bold" title={key}>
                      {key}
                    </div>
                    <div className={`mono mt-0.5 text-[11px] ${fresh ? 'text-[#15803d]' : 'text-[#92600c]'}`}>
                      {ago(v.ts)}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      <div className="mb-4 rounded-[16px] border border-[#E1EAEA] bg-white p-4">
        <div className="mb-1.5 text-xs font-black tracking-[0.08em] text-[#11302E]/55">PUSH ÉRTESÍTÉSEK</div>
        <div className="mb-3 text-[13px] text-[#11302E]/70">
          Eredmény mentéskor és cron által talált új végeredménynél automatikus értesítés megy, ha a VAPID
          kulcsok be vannak állítva.
        </div>
        <button
          onClick={() =>
            void write(
              'push',
              { title: 'Tomifoci teszt', body: 'Push értesítés működik.', url: '/meccs-center' },
              '✓ Teszt push elküldve · naplózva'
            )
          }
          className="rounded-[11px] border border-[#cfe0de] bg-[#f6faf9] px-5 py-[11px] text-[14px] font-extrabold text-[#007E73]"
        >
          🔔 Teszt push küldése
        </button>
      </div>

      <div className="rounded-[16px] border border-[#f3d2cf] bg-white p-4">
        <div className="mb-1.5 text-xs font-black tracking-[0.08em] text-[#E5484D]">
          ⚠️ VÉSZHELYZETI KÉZI POLL
        </div>
        <div className="mb-3 text-[13px] text-[#11302E]/70">
          A poll normál esetben automatikus (szerveroldali cron). A kézi lekérés kvótát éget — csak akkor, ha
          az automata leállt.
        </div>
        <label className="mb-3 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={emergency}
            onChange={(e) => setEmergency(e.target.checked)}
            className="size-[18px]"
          />
          <span className="text-[13px] font-bold">Megerősítem: vészhelyzeti üzemmód</span>
        </label>
        <button
          onClick={() => {
            if (!emergency) {
              showToast('Előbb erősítsd meg a vészhelyzeti üzemmódot')
              return
            }
            ask({
              title: 'Kézi poll futtatása?',
              body: 'Azonnali LiveScore lekérés indul. Ez API-kvótát éget — csak ha az automata poll leállt.',
              danger: true,
              yes: 'Futtatás',
              onYes: () => void write('poll', { manual: true }, '✓ Kézi LiveScore poll lefuttatva · naplózva')
            })
          }}
          className="rounded-[11px] px-5 py-[11px] text-[14px] font-extrabold"
          style={
            emergency
              ? { background: '#E5484D', color: '#fff' }
              : { background: '#f1d6d4', color: '#b06a66', cursor: 'not-allowed' }
          }
        >
          📡 Kézi poll futtatása
        </button>
      </div>
    </>
  )
}

// ── LOG ─────────────────────────────────────────────────────────────────────

function LogSection({
  state,
  ask,
  write,
  showToast
}: {
  state: GameState | null
  ask: AskFn
  write: WriteFn
  showToast: (m: string) => void
}) {
  const log = txnEntries(state)

  function exportCsv() {
    if (log.length === 0) {
      showToast('Nincs exportálható naplóbejegyzés')
      return
    }
    const header = ['ts', 'who', 'type', 'label', 'path']
    const lines = [
      header.join(','),
      ...log.map((l) =>
        [fmtTs(l.ts), l.who ?? '', l.type ?? '', l.label ?? '', l.path ?? '']
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(',')
      )
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tomifoci-naplo-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('⬇ CSV export elindult')
  }

  return (
    <>
      <div className="mb-3.5 flex justify-end gap-2.5">
        <button
          onClick={exportCsv}
          className="rounded-[10px] border border-[#E1EAEA] bg-white px-[15px] py-2 text-[13px] font-bold text-[#11302E]"
        >
          ⬇ CSV export
        </button>
        <button
          onClick={() =>
            ask({
              title: 'Napló ürítése?',
              body: 'A tranzakciós napló archiválásra kerül. Ez nem vonja vissza a műveleteket, csak a listát üríti.',
              danger: true,
              yes: 'Ürítés',
              onYes: () => void write('log', { action: 'clear' }, '✓ Napló archiválva · naplózva')
            })
          }
          className="rounded-[10px] border border-[#f3d2cf] bg-white px-[15px] py-2 text-[13px] font-bold text-[#E5484D]"
        >
          Napló ürítése
        </button>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#E1EAEA] bg-white">
        {log.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-[#11302E]/50">
            {state ? 'Nincs naplóbejegyzés.' : 'Betöltés…'}
          </div>
        ) : (
          log.map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[#F1F5F5] px-4 py-3 last:border-b-0"
            >
              <span className="mono w-[96px] flex-none text-[11px] text-[#11302E]/45">{fmtTs(l.ts)}</span>
              <span className="flex-1 text-[13px] font-semibold">{l.label ?? '—'}</span>
              <span className="text-[11px] text-[#11302E]/45">{l.who ?? ''}</span>
              <button
                onClick={() =>
                  ask({
                    title: 'Tranzakció visszagörgetése?',
                    body: `A(z) „${l.label ?? '—'}” művelet visszavonásra kerül és a pontok újraszámolódnak.`,
                    danger: true,
                    yes: 'Visszagörgetés',
                    onYes: () =>
                      void write(
                        'log',
                        { action: 'rollback', ts: l.ts },
                        `✓ Visszagörgetve — ${l.label ?? ''} · naplózva`
                      )
                  })
                }
                className="rounded-[9px] border border-[#cfe0de] bg-[#f6faf9] px-3 py-1.5 text-[12px] font-bold text-[#007E73]"
              >
                ↩ Vissza
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-2.5 text-[12px] text-[#11302E]/50">
        Csak prediktum-tipp tranzakciók görgethetők vissza; egyéb bejegyzéseknél a backend „nem
        visszafordítható” választ ad.
      </div>
    </>
  )
}

// ── LEADS ───────────────────────────────────────────────────────────────────

type LeadRow = {
  id: string
  name: string
  contact: string
  message: string
  community: 'hu' | 'en'
  ts: number
  handled: boolean
}

function Leads({
  token,
  adminSession,
  showToast
}: {
  token: string
  adminSession: string
  showToast: (m: string) => void
}) {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function post(body: unknown): Promise<{ ok?: boolean; error?: string; leads?: LeadRow[] }> {
    const res = await fetch('/api/admin/leads', {
      method: 'POST',
      headers: adminHeaders(token, adminSession),
      body: JSON.stringify(body)
    })
    return (await res.json().catch(() => ({ ok: false, error: 'no-json' }))) as {
      ok?: boolean
      error?: string
      leads?: LeadRow[]
    }
  }

  async function load() {
    setBusy(true)
    setErr(null)
    try {
      const json = await post({ action: 'list' })
      if (json.ok) setLeads(json.leads ?? [])
      else setErr(writeErrorMsg(json.error))
    } catch {
      setErr('Backend még nincs bekötve')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggle(lead: LeadRow) {
    const json = await post({ action: 'setHandled', id: lead.id, handled: !lead.handled })
    if (json.ok) {
      await load()
      showToast(lead.handled ? '✓ Érdeklődő újranyitva · naplózva' : '✓ Érdeklődő kezelve · naplózva')
    } else {
      showToast(writeErrorMsg(json.error))
    }
  }

  const pending = leads.filter((l) => !l.handled).length

  return (
    <div className="rounded-[16px] border border-[#E1EAEA] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF3F3] px-4 py-3">
        <div>
          <div className="text-xs font-black tracking-[0.08em] text-[#11302E]/55">BEÉRKEZŐ ÉRDEKLŐDŐK</div>
          <div className="mt-0.5 text-[13px] text-[#11302E]/55">
            {leads.length} összesen · {pending} nyitott
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="rounded-[10px] border border-[#E1EAEA] bg-white px-3.5 py-2 text-[12px] font-bold text-[#11302E] disabled:opacity-50"
        >
          ⟳ Frissítés
        </button>
      </div>

      {err ? (
        <div className="px-4 py-6 text-center text-[13px] font-bold text-[#E5484D]">{err}</div>
      ) : leads.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="text-[28px]">📨</div>
          <div className="mt-2 text-[15px] font-black">{busy ? 'Betöltés…' : 'Nincs érdeklődő'}</div>
          <div className="mx-auto mt-1 max-w-[360px] text-[13px] text-[#11302E]/55">
            A landing érdeklődési űrlapjának beérkező üzenetei itt jelennek meg.
          </div>
        </div>
      ) : (
        leads.map((lead) => {
          const href = contactHref(lead.contact)
          const contact = href ? (
            <a href={href} className="font-bold text-[#007E73] underline underline-offset-2">
              {lead.contact}
            </a>
          ) : (
            <span className="font-bold">{lead.contact}</span>
          )
          return (
            <div
              key={lead.id}
              className={`flex flex-wrap items-center gap-3 border-b border-[#F1F5F5] px-4 py-3 last:border-b-0 ${lead.handled ? 'opacity-60' : ''}`}
            >
              <div className="min-w-[190px] flex-1">
                <div className="text-[14px] font-black">{lead.name}</div>
                <div className="mt-0.5 text-[12px] text-[#11302E]/55">
                  {contact} · {lead.community.toUpperCase()} · {lead.ts ? fmtTs(lead.ts) : '—'}
                </div>
                {lead.message && <div className="mt-1 text-[13px] text-[#11302E]/70">{lead.message}</div>}
              </div>
              <button
                onClick={() => void toggle(lead)}
                className={
                  lead.handled
                    ? 'rounded-[9px] border border-[#c2e6cf] bg-[#e4f5ea] px-3.5 py-2 text-[12px] font-bold text-[#15803d]'
                    : 'rounded-[9px] border border-[#E1EAEA] bg-white px-3.5 py-2 text-[12px] font-bold text-[#11302E]'
                }
              >
                {lead.handled ? '✓ Kezelve' : 'Kezeltnek jelöl'}
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}

function contactHref(contact: string): string | null {
  if (contact.includes('@')) return `mailto:${contact}`
  const phone = contact.replace(/[^\d+]/g, '')
  return phone.length >= 7 ? `tel:${phone}` : null
}

// ── BACKUP / RESTORE ────────────────────────────────────────────────────────

// Raw restore payload shape (matches the backup route's RawState). The route
// reads predictions/results/importedRows as arrays; settings is opaque here.
type RawStateFile = {
  settings?: unknown
  predictions?: unknown[]
  results?: unknown[]
  importedRows?: unknown[]
}

function Backup({
  token,
  adminSession,
  ask,
  showToast,
  onApplied
}: {
  token: string
  adminSession: string
  ask: AskFn
  showToast: (m: string) => void
  onApplied: () => void
}) {
  const [file, setFile] = useState<{ name: string; size: number; data: RawStateFile } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const step = file ? 1 : 0

  async function postBackup(
    body: unknown
  ): Promise<{ ok?: boolean; error?: string; dryRun?: boolean; summary?: any; applied?: any }> {
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: adminHeaders(token, adminSession),
        body: JSON.stringify(body)
      })
      return (await res.json().catch(() => ({ ok: false, error: 'no-json' }))) as any
    } catch {
      return { ok: false, error: 'network' }
    }
  }

  // Export uses the route's `export` action — full raw state (INV-09 redacted),
  // in the exact shape `restore` re-imports, so export → restore round-trips.
  async function exportState() {
    try {
      const json = await postBackup({ action: 'export' })
      if (!json.ok) {
        showToast(writeErrorMsg(json.error))
        return
      }
      const payload = (json as { state?: unknown }).state ?? json
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tomifoci-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('⬇ Mentés letöltése elindult')
    } catch {
      showToast('Az exportálás nem sikerült')
    }
  }

  async function onPick(f: File) {
    try {
      const text = await f.text()
      const parsed = JSON.parse(text)
      // Accept either a raw RawState file or the route export wrapper ({ state }).
      const data = (
        parsed && typeof parsed === 'object' && 'state' in parsed ? parsed.state : parsed
      ) as RawStateFile
      setFile({ name: f.name, size: f.size, data })
    } catch {
      showToast('Érvénytelen JSON fájl')
    }
  }

  // Step 1: dry-run (sends the parsed data, no confirm) → show the diff the route
  // returns. Step 2: on confirm, apply with confirm:true (merge-upsert, INV-11).
  async function dryRunThenConfirm() {
    if (!file) return
    setBusy(true)
    const dry = await postBackup({ action: 'restore', data: file.data })
    setBusy(false)
    if (!dry.ok) {
      showToast(writeErrorMsg(dry.error))
      return
    }
    const s = dry.summary ?? {}
    const part = (label: string, v: any) =>
      v && typeof v === 'object'
        ? `${label}: +${v.add ?? 0} új${v.change != null ? `, ${v.change} módosul` : ''}${v.overwrite != null ? `, ${v.overwrite} felülír` : ''} (${v.total ?? 0})`
        : null
    const lines = [
      part('Tippek', s.predictions),
      part('Eredmények', s.results),
      part('Sorok', s.importedRows)
    ].filter(Boolean)
    const body = lines.length
      ? `Próbafuttatás kész — a megerősítés után a mentés merge-upsert módon íródik be (semmi nem törlődik):\n\n${lines.join('\n')}`
      : 'A mentés nem tartalmaz visszaállítható adatot (tippek / eredmények / sorok).'
    ask({
      title: 'Visszaállítás megerősítése?',
      body,
      danger: true,
      yes: 'Visszaállítás',
      onYes: async () => {
        const applied = await postBackup({ action: 'restore', data: file.data, confirm: true })
        if (applied.ok) {
          onApplied()
          setFile(null)
        } else {
          showToast(writeErrorMsg(applied.error))
        }
      }
    })
  }

  const stepPill = (n: number, label: string, on: boolean) => (
    <span
      key={n}
      className="rounded-[8px] px-[11px] py-1.5 text-[12px] font-extrabold"
      style={
        on
          ? { background: '#E5484D', color: '#fff' }
          : { background: '#f1f5f5', color: 'rgba(17,48,46,.45)', fontWeight: 700 }
      }
    >
      {label}
    </span>
  )

  return (
    <div className="max-w-[620px]">
      <div className="mb-4 rounded-[16px] border border-[#E1EAEA] bg-white p-[18px]">
        <div className="mb-2 text-xs font-black tracking-[0.08em] text-[#11302E]/55">
          💾 BIZTONSÁGI MENTÉS
        </div>
        <div className="mb-3.5 text-[13px] text-[#11302E]/70">
          A teljes játékállapot exportja JSON-ként. Készíts mentést bármilyen kockázatos művelet előtt.
        </div>
        <button
          onClick={exportState}
          className="rounded-[11px] px-5 py-[11px] text-[14px] font-extrabold"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          ⬇ Állapot exportálása
        </button>
        <div className="mono mt-2.5 text-[11px] text-[#11302E]/45">
          Az export az élő /api/state válaszból készül.
        </div>
      </div>

      <div className="rounded-[16px] border border-[#f3d2cf] bg-white p-[18px]">
        <div className="mb-2 text-xs font-black tracking-[0.08em] text-[#E5484D]">
          ♻️ VISSZAÁLLÍTÁS — biztonságos folyamat
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {stepPill(1, '1 · Fájl', step >= 0)}
          <span className="text-[#11302E]/30">→</span>
          {stepPill(2, '2 · Próbafuttatás', step >= 1)}
          <span className="text-[#11302E]/30">→</span>
          {stepPill(3, '3 · Eltérés', false)}
          <span className="text-[#11302E]/30">→</span>
          {stepPill(4, '4 · Megerősítés', false)}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onPick(f)
          }}
        />

        {step === 0 ? (
          <div className="rounded-[12px] border-2 border-dashed border-[#d3e6e4] p-6 text-center text-[13px] text-[#11302E]/60">
            JSON mentés kiválasztása:{' '}
            <button
              onClick={() => fileRef.current?.click()}
              className="font-extrabold text-[#007E73] underline"
            >
              tallózás
            </button>
          </div>
        ) : (
          <div>
            <div className="mono mb-3.5 rounded-[10px] border border-[#E1EAEA] bg-[#f6faf9] px-[13px] py-[11px] text-[12px]">
              📄 {file?.name} · {file ? Math.max(1, Math.round(file.size / 1024)) : 0} KB
            </div>
            <div className="mb-3.5 text-[13px] text-[#11302E]/70">
              A próbafuttatás összeveti a mentést az élő állapottal — semmi nem íródik felül, amíg meg nem
              erősíted. A visszaállítás merge-upsert: csak hozzáad vagy felülír, sosem töröl (INV-11).
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void dryRunThenConfirm()}
                disabled={busy}
                className="rounded-[11px] px-5 py-[11px] text-[14px] font-extrabold text-white disabled:opacity-60"
                style={{ background: '#E5484D' }}
              >
                {busy ? 'Próbafuttatás…' : '▶ Próbafuttatás & visszaállítás'}
              </button>
              <button
                onClick={() => setFile(null)}
                className="rounded-[11px] border border-[#E1EAEA] bg-white px-[18px] py-[11px] text-[14px] font-bold text-[#11302E]"
              >
                Mégse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── shared atoms ────────────────────────────────────────────────────────────

function Step({ value, set }: { value: number; set: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => set(Math.max(0, value - 1))}
        className="size-[34px] rounded-[9px] border border-[#E1EAEA] bg-[#f6faf9] text-[16px] font-extrabold text-[#007E73]"
      >
        −
      </button>
      <span className="tnum w-[34px] text-center text-[18px] font-black">{value}</span>
      <button
        onClick={() => set(Math.min(20, value + 1))}
        className="size-[34px] rounded-[9px] border border-[#E1EAEA] bg-[#f6faf9] text-[16px] font-extrabold text-[#007E73]"
      >
        +
      </button>
    </div>
  )
}

function Tile({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-[14px] border border-[#E1EAEA] bg-white p-[15px]">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#11302E]/50">{label}</div>
      <div className="tnum mt-1 text-[28px] font-black">
        {value}
        {suffix && <span className="text-[14px] text-[#11302E]/40">{suffix}</span>}
      </div>
    </div>
  )
}

function Status({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="mt-2.5 flex items-center justify-between">
      <span className="text-[13px] font-semibold">{label}</span>
      <span
        className="mono rounded-[7px] px-[9px] py-[3px] text-[11px] font-bold"
        style={ok ? { color: '#15803d', background: '#e4f5ea' } : { color: '#E5484D', background: '#fdeceb' }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Diagnostics / automated self-test ────────────────────────────────────────
type DiagCheck = { name: string; ok: boolean; detail: string; severity: 'pass' | 'warn' | 'fail' }

function Diagnostics({ token, adminSession }: { token: string; adminSession: string }) {
  const [checks, setChecks] = useState<DiagCheck[] | null>(null)
  const [running, setRunning] = useState(false)
  const [ranAt, setRanAt] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/diagnostics', {
        headers: adminHeaders(token, adminSession, false),
        cache: 'no-store'
      })
      const json = await res.json()
      if (json.checks) {
        setChecks(json.checks as DiagCheck[])
        setRanAt(json.ts ?? Date.now())
      } else {
        setErr(
          json.error === 'admin-not-configured'
            ? 'ADMIN_TOKEN nincs beállítva'
            : json.error === 'unauthorized'
              ? 'Hibás token'
              : (json.error ?? 'hiba')
        )
      }
    } catch {
      setErr('network')
    } finally {
      setRunning(false)
    }
  }

  const passCount = checks?.filter((c) => c.ok).length ?? 0
  const total = checks?.length ?? 0

  return (
    <div className="animate-in">
      <div className="mb-4 rounded-[12px] border border-[#d3e6e4] bg-[#eef6f6] px-[15px] py-3 text-[13px] text-[#11302E]">
        🔬 Önteszt — élőben futtatja a rendszer-ellenőrzéseket (adatbázis, írás-egészség, adatintegritás,
        származtatott rangsorok, auth). Csak olvasás + egy eldobható szondasor; nem módosít adatot.
      </div>

      <button
        onClick={run}
        disabled={running}
        className="rounded-[11px] px-5 py-[11px] text-[14px] font-extrabold"
        style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
      >
        {running ? 'Tesztek futnak…' : '▶ Önteszt futtatása'}
      </button>

      {err && <div className="mt-3 text-[13px] font-bold text-[#E5484D]">{err}</div>}

      {checks && (
        <>
          <div className="mb-2 mt-5 flex items-center justify-between">
            <span className="text-xs font-black tracking-[0.08em] text-[#11302E]/55">
              EREDMÉNY · {passCount}/{total} OK
            </span>
            {ranAt && (
              <span className="mono text-[11px] text-[#11302E]/50">
                {new Date(ranAt).toLocaleTimeString('hu')}
              </span>
            )}
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[#E1EAEA] bg-white">
            {checks.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 border-b border-[#F1F5F5] px-4 py-3 last:border-b-0"
              >
                <span className="text-[16px]">
                  {c.severity === 'pass' ? '✅' : c.severity === 'warn' ? '⚠️' : '❌'}
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-[#11302E]">{c.name}</div>
                  <div className="mono text-[11px] text-[#11302E]/55">{c.detail}</div>
                </div>
                <span
                  className="mono rounded-[7px] px-[9px] py-[3px] text-[11px] font-bold"
                  style={
                    c.severity === 'pass'
                      ? { color: '#15803d', background: '#e4f5ea' }
                      : c.severity === 'warn'
                        ? { color: '#92600c', background: '#fff7e6' }
                        : { color: '#E5484D', background: '#fdeceb' }
                  }
                >
                  {c.severity === 'pass' ? 'OK' : c.severity === 'warn' ? 'FIGYELEM' : 'HIBA'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

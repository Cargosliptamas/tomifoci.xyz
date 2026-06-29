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

async function adminPost(path: string, token: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body)
    })
    const json = (await res.json().catch(() => ({ ok: false, error: 'no-json' }))) as { ok?: boolean; error?: string }
    if (json.ok) return { ok: true }
    return { ok: false, error: json.error ?? `http-${res.status}` }
  } catch {
    return { ok: false, error: 'network' }
  }
}

function writeErrorMsg(error?: string): string {
  if (error === 'admin-not-configured') return 'ADMIN_TOKEN nincs beállítva a Vercelben'
  if (error === 'unauthorized') return 'Hibás token'
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

// ── page ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState('')
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
    const res = await adminPost(path, token, body)
    if (res.ok) {
      await loadState()
      showToast(successMsg)
    } else {
      showToast(writeErrorMsg(res.error))
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
          <div className="mono mt-[10px] text-[11px] tracking-[0.04em] text-white/50">ADMIN_TOKEN belépés</div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="mono mt-6 w-full rounded-[12px] border border-white/20 bg-white/10 px-4 py-3 text-center text-white placeholder-white/40 outline-none"
          />
          <button
            onClick={() => token && setAuthed(true)}
            className="mt-4 w-full rounded-[12px] py-3 text-[14px] font-black"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
          >
            Belépés
          </button>
          <div className="mt-4 text-[11px] text-white/40">
            A token a Vercel <span className="mono">ADMIN_TOKEN</span> változójával egyezik. Ha nincs beállítva,
            az írási műveletek le vannak tiltva.
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
            <span className="flex size-[30px] items-center justify-center rounded-[9px] text-white" style={{ background: 'linear-gradient(160deg,#0C4D49,#0F6A64)' }}>
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
                <span className="rounded-full bg-[#fff3d6] px-[7px] py-[2px] text-[9px] font-extrabold text-[#9a6b00]">FŐADMIN</span>
                <button
                  onClick={() => {
                    setAuthed(false)
                    setToken('')
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
            {section === 'dash' && <Dashboard state={state} onRecompute={() => void loadState().then(() => showToast('✓ Állapot frissítve'))} />}
            {section === 'players' && <Players state={state} ask={ask} write={write} showToast={showToast} />}
            {section === 'results' && <Results token={token} onSaved={(m) => void loadState().then(() => showToast(m))} />}
            {section === 'override' && <Override state={state} ask={ask} write={write} />}
            {section === 'bonus' && <Bonuses state={state} ask={ask} write={write} />}
            {section === 'swiss' && <Swiss state={state} ask={ask} write={write} />}
            {section === 'api' && <ApiSection state={state} ask={ask} write={write} showToast={showToast} />}
            {section === 'log' && <LogSection state={state} ask={ask} write={write} showToast={showToast} />}
            {section === 'leads' && <Leads />}
            {section === 'backup' && <Backup ask={ask} write={write} showToast={showToast} />}
            {section === 'diag' && <Diagnostics token={token} />}
          </div>
        </main>
      </div>

      {confirm && (
        <div
          onClick={() => setConfirm(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          style={{ background: 'rgba(8,54,60,.5)', backdropFilter: 'blur(3px)' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-[18px] bg-white p-[22px] shadow-[0_24px_60px_rgba(8,54,60,0.4)]">
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
                style={confirm.danger ? { background: '#E5484D' } : { background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
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
  const predictions = state ? Object.values(state.predictions).reduce((n, m) => n + Object.keys(m).length, 0) : 0
  const results = state ? Object.keys(state.results).length : 0
  const round = state?.swiss?.round
  const log = state?.swissLog ?? []

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
          <Status label="Adatbázis (Neon)" ok={Boolean(state)} value={state ? 'kapcsolódva' : 'nincs kapcsolat'} />
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
                  <span className="text-[13px] font-semibold text-[#11302E]">{l.action ?? '—'}</span>
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

function Players({ state, ask, write, showToast }: { state: GameState | null; ask: AskFn; write: WriteFn; showToast: (m: string) => void }) {
  const [search, setSearch] = useState('')
  const players = state?.settings.players ?? []
  const q = search.toLowerCase()
  const list = players.filter((p) => !q || p.name.toLowerCase().includes(q))

  return (
    <>
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
          <span className="w-[120px]">LIGA</span>
          <span className="w-[120px] text-right">MŰVELET</span>
        </div>
        {list.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-[#11302E]/50">
            {state ? 'Nincs a keresésnek megfelelő játékos.' : 'Betöltés…'}
          </div>
        ) : (
          list.map((p) => (
            <div key={p.name} className="flex items-center border-b border-[#F1F5F5] px-4 py-[11px] last:border-b-0">
              <span className="flex flex-1 items-center gap-2.5">
                <span className="flex size-[30px] items-center justify-center rounded-full bg-[#EBF6F5] text-[12px] font-black text-[#007E73]">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[14px] font-bold">{p.name}</span>
              </span>
              <span className="w-[120px] text-[12px] font-semibold text-[#11302E]/60">{p.leagues?.[0] ?? '—'}</span>
              <span className="flex w-[120px] justify-end gap-1.5">
                <button
                  onClick={() => showToast('Backend még nincs bekötve')}
                  className="rounded-[8px] border border-[#E1EAEA] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#11302E]"
                >
                  ✏️
                </button>
                <button
                  onClick={() =>
                    ask({
                      title: 'Játékos törlése?',
                      body: `„${p.name}” archiválásra kerül és 30 napig visszaállítható. A tippjei és származtatott pontjai eltávolításra kerülnek a rangsorból.`,
                      danger: true,
                      yes: 'Archiválás',
                      onYes: () => void write('players', { action: 'delete', name: p.name }, `✓ Játékos archiválva — ${p.name} · naplózva`)
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
        🗄 TÖRÖLT JÁTÉKOSOK <span className="font-bold text-[#11302E]/40">· 30 napos visszaállítási ablak</span>
      </div>
      <div className="rounded-[16px] border border-[#E1EAEA] bg-white px-4 py-6 text-center text-[13px] text-[#11302E]/50">
        Nincs törölt játékos.
      </div>
    </>
  )
}

// ── RESULTS (existing — unchanged behaviour) ────────────────────────────────

function Results({ token, onSaved }: { token: string; onSaved: (msg: string) => void }) {
  const [search, setSearch] = useState('')
  const list = useMemo(() => {
    const q = search.toLowerCase()
    return MATCHES.filter((m) => !q || m.home.toLowerCase().includes(q) || m.away.toLowerCase().includes(q) || String(m.id) === q).slice(0, 60)
  }, [search])

  return (
    <>
      <div className="mb-4 rounded-[12px] border border-[#d3e6e4] bg-[#eef6f6] px-[15px] py-3 text-[13px] text-[#11302E]">
        ⚠️ Eredmény mentése azonnal újraszámolja az érintett pontokat. A mentés <b>upsert</b> — nincs tömeges felülírás.
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Mérkőzés keresése (csapat vagy #id)…"
        className="mb-3 w-full rounded-[11px] border border-[#E1EAEA] bg-white px-[14px] py-[11px] text-[14px] outline-none"
      />
      <div className="flex flex-col gap-3">
        {list.map((m) => (
          <ResultRow key={m.id} token={token} fixture={m} onSaved={onSaved} />
        ))}
      </div>

      <div className="mb-2.5 mt-[22px] text-xs font-black tracking-[0.08em] text-[#11302E]/55">🏆 KIESÉSES PÁROSÍTÁSOK (KO)</div>
      <div className="rounded-[14px] border border-[#E1EAEA] bg-white p-[15px] text-[13px] text-[#11302E]/70">
        A KO-helyek a csoporteredményekből <b>automatikusan</b> származnak (bracket.autoUpdateBracket). Kézi felülírás csak
        vészhelyzetben — minden manuális slot jelölve lesz.
      </div>
    </>
  )
}

function ResultRow({
  token,
  fixture,
  onSaved
}: {
  token: string
  fixture: { id: number; home: string; away: string }
  onSaved: (msg: string) => void
}) {
  const [h, setH] = useState(0)
  const [a, setA] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send(action: 'save' | 'clear') {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/result', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ matchId: fixture.id, h, a, action })
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok) onSaved(action === 'clear' ? `✓ Eredmény törölve — #${fixture.id} · naplózva` : `✓ Eredmény mentve — #${fixture.id} · ${h}:${a}`)
      else setErr(json.error === 'admin-not-configured' ? 'ADMIN_TOKEN nincs beállítva a Vercelben' : json.error === 'unauthorized' ? 'Hibás token' : json.error ?? 'hiba')
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
        Egy játékos tippjének felülírása érzékeny művelet — naplózásra kerül és újraszámolja a pontokat (a Wizard-tükrözést
        is). Csak indokolt esetben.
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
                void write('override', { player: selectedPlayer, matchId, h, a }, `✓ Tipp felülírva — ${selectedPlayer} · #${matchId} · naplózva`)
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
        <div className="px-4 pb-2.5 pt-3.5 text-xs font-black tracking-[0.08em] text-[#11302E]/55">LEGUTÓBBI BÓNUSZOK</div>
        {bonusList.length === 0 ? (
          <div className="px-4 pb-5 text-[13px] text-[#11302E]/50">Nincs rögzített bónusz.</div>
        ) : (
          bonusList.map((b) => (
            <div key={`${b.name}-${b.idx}`} className="flex items-center border-t border-[#F1F5F5] px-4 py-[11px]">
              <div className="flex-1">
                <div className="text-[14px] font-bold">
                  {b.name} <span className="font-black text-[#15803d]">{b.pts >= 0 ? `+${b.pts}` : b.pts}</span>
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
                    onYes: () => void write('bonus', { action: 'remove', player: b.name, index: b.idx }, `✓ Bónusz visszavonva — ${b.name} · naplózva`)
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#E1EAEA] bg-white px-4 py-3.5">
        <span className="text-[14px] font-extrabold">Forduló:</span>
        <span className="rounded-[9px] bg-[#EBF6F5] px-3.5 py-1.5 text-[14px] font-black text-[#007E73]">{round}. forduló</span>
        <span className="flex-1 text-[12px] text-[#11302E]/55">
          Állapot: <b className={frozen ? 'text-[#92600c]' : 'text-[#15803d]'}>{frozen ? 'befagyasztva' : 'aktív'}</b> · a
          standings a 10. forduló után fagy be
        </span>
        <button
          onClick={() =>
            ask({
              title: 'Forduló újrasorsolása?',
              body: `A(z) ${round}. forduló párosításai újragenerálódnak és minden származtatott állapot újraszámolódik. A művelet naplózásra kerül.`,
              danger: true,
              yes: 'Újrasorsolás',
              onYes: () => void write('swiss', { action: 'reshuffle', round }, `✓ ${round}. forduló újrasorsolva · naplózva`)
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

      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => void write('swiss', { action: 'publish', round }, `✓ ${round}. forduló párosítás publikálva · naplózva`)}
          className="rounded-[12px] px-[22px] py-3 text-[14px] font-black"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          ✓ Párosítás publikálása
        </button>
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
                    <div className={`mono mt-0.5 text-[11px] ${fresh ? 'text-[#15803d]' : 'text-[#92600c]'}`}>{ago(v.ts)}</div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      <div className="rounded-[16px] border border-[#f3d2cf] bg-white p-4">
        <div className="mb-1.5 text-xs font-black tracking-[0.08em] text-[#E5484D]">⚠️ VÉSZHELYZETI KÉZI POLL</div>
        <div className="mb-3 text-[13px] text-[#11302E]/70">
          A poll normál esetben automatikus (szerveroldali cron). A kézi lekérés kvótát éget — csak akkor, ha az automata
          leállt.
        </div>
        <label className="mb-3 flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="size-[18px]" />
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
  const log = state?.swissLog ?? []

  function exportCsv() {
    if (log.length === 0) {
      showToast('Nincs exportálható naplóbejegyzés')
      return
    }
    const header = ['ts', 'who', 'action']
    const lines = [
      header.join(','),
      ...log.map((l) => [fmtTs(l.ts), l.who ?? '', l.action ?? ''].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
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
        <button onClick={exportCsv} className="rounded-[10px] border border-[#E1EAEA] bg-white px-[15px] py-2 text-[13px] font-bold text-[#11302E]">
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
          <div className="px-4 py-6 text-center text-[13px] text-[#11302E]/50">{state ? 'Nincs naplóbejegyzés.' : 'Betöltés…'}</div>
        ) : (
          log.map((l, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[#F1F5F5] px-4 py-3 last:border-b-0">
              <span className="mono w-[96px] flex-none text-[11px] text-[#11302E]/45">{fmtTs(l.ts)}</span>
              <span className="flex-1 text-[13px] font-semibold">{l.action ?? '—'}</span>
              <span className="text-[11px] text-[#11302E]/45">{l.who ?? ''}</span>
              <button
                onClick={() =>
                  ask({
                    title: 'Tranzakció visszagörgetése?',
                    body: `A(z) „${l.action ?? '—'}” művelet visszavonásra kerül és a pontok újraszámolódnak.`,
                    danger: true,
                    yes: 'Visszagörgetés',
                    onYes: () => void write('log', { action: 'rollback', ts: l.ts }, `✓ Visszagörgetve — ${l.action ?? ''} · naplózva`)
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
        A visszagörgetés a backend bekötése után lép életbe; a gomb addig is naplózottan jelez vissza.
      </div>
    </>
  )
}

// ── LEADS ───────────────────────────────────────────────────────────────────

function Leads() {
  return (
    <div className="rounded-[16px] border border-[#E1EAEA] bg-white px-4 py-10 text-center">
      <div className="text-[28px]">📨</div>
      <div className="mt-2 text-[15px] font-black">Nincs érdeklődő</div>
      <div className="mx-auto mt-1 max-w-[360px] text-[13px] text-[#11302E]/55">
        A kapcsolati űrlap beérkező üzenetei itt jelennek meg. Ehhez a szekcióhoz még nincs adatforrás bekötve.
      </div>
    </div>
  )
}

// ── BACKUP / RESTORE ────────────────────────────────────────────────────────

function Backup({ ask, write, showToast }: { ask: AskFn; write: WriteFn; showToast: (m: string) => void }) {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const step = file ? 1 : 0

  async function exportState() {
    try {
      const res = await fetch('/api/state?community=hu', { cache: 'no-store' })
      const json = await res.json()
      const payload = json.state ?? json
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

  const stepPill = (n: number, label: string, on: boolean) => (
    <span
      key={n}
      className="rounded-[8px] px-[11px] py-1.5 text-[12px] font-extrabold"
      style={on ? { background: '#E5484D', color: '#fff' } : { background: '#f1f5f5', color: 'rgba(17,48,46,.45)', fontWeight: 700 }}
    >
      {label}
    </span>
  )

  return (
    <div className="max-w-[620px]">
      <div className="mb-4 rounded-[16px] border border-[#E1EAEA] bg-white p-[18px]">
        <div className="mb-2 text-xs font-black tracking-[0.08em] text-[#11302E]/55">💾 BIZTONSÁGI MENTÉS</div>
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
        <div className="mono mt-2.5 text-[11px] text-[#11302E]/45">Az export az élő /api/state válaszból készül.</div>
      </div>

      <div className="rounded-[16px] border border-[#f3d2cf] bg-white p-[18px]">
        <div className="mb-2 text-xs font-black tracking-[0.08em] text-[#E5484D]">♻️ VISSZAÁLLÍTÁS — biztonságos folyamat</div>
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
            if (f) setFile({ name: f.name, size: f.size })
          }}
        />

        {step === 0 ? (
          <div className="rounded-[12px] border-2 border-dashed border-[#d3e6e4] p-6 text-center text-[13px] text-[#11302E]/60">
            JSON mentés kiválasztása:{' '}
            <button onClick={() => fileRef.current?.click()} className="font-extrabold text-[#007E73] underline">
              tallózás
            </button>
          </div>
        ) : (
          <div>
            <div className="mono mb-3.5 rounded-[10px] border border-[#E1EAEA] bg-[#f6faf9] px-[13px] py-[11px] text-[12px]">
              📄 {file?.name} · {file ? Math.max(1, Math.round(file.size / 1024)) : 0} KB
            </div>
            <div className="mb-3.5 text-[13px] text-[#11302E]/70">
              A próbafuttatás összeveti a mentést az élő állapottal — semmi nem íródik felül, amíg meg nem erősíted. A
              dry-run a backend bekötése után érhető el.
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  ask({
                    title: 'Visszaállítás megerősítése?',
                    body: 'A mentés felülírja az élő állapotot. Visszaállítási pont automatikusan készül a felülírás előtt.',
                    danger: true,
                    yes: 'Visszaállítás',
                    onYes: () => {
                      void write('backup', { action: 'restore', file: file?.name }, '✓ Állapot visszaállítva mentésből · naplózva')
                      setFile(null)
                    }
                  })
                }
                className="rounded-[11px] px-5 py-[11px] text-[14px] font-extrabold text-white"
                style={{ background: '#E5484D' }}
              >
                ▶ Próbafuttatás & visszaállítás
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
      <button onClick={() => set(Math.max(0, value - 1))} className="size-[34px] rounded-[9px] border border-[#E1EAEA] bg-[#f6faf9] text-[16px] font-extrabold text-[#007E73]">
        −
      </button>
      <span className="tnum w-[34px] text-center text-[18px] font-black">{value}</span>
      <button onClick={() => set(Math.min(20, value + 1))} className="size-[34px] rounded-[9px] border border-[#E1EAEA] bg-[#f6faf9] text-[16px] font-extrabold text-[#007E73]">
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

function Diagnostics({ token }: { token: string }) {
  const [checks, setChecks] = useState<DiagCheck[] | null>(null)
  const [running, setRunning] = useState(false)
  const [ranAt, setRanAt] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/diagnostics', { headers: { 'x-admin-token': token }, cache: 'no-store' })
      const json = await res.json()
      if (json.checks) {
        setChecks(json.checks as DiagCheck[])
        setRanAt(json.ts ?? Date.now())
      } else {
        setErr(json.error === 'admin-not-configured' ? 'ADMIN_TOKEN nincs beállítva' : json.error === 'unauthorized' ? 'Hibás token' : json.error ?? 'hiba')
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
        🔬 Önteszt — élőben futtatja a rendszer-ellenőrzéseket (adatbázis, írás-egészség, Convex↔Neon szinkron,
        adatintegritás, származtatott rangsorok, auth). Csak olvasás + egy eldobható szondasor; nem módosít adatot.
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
            {ranAt && <span className="mono text-[11px] text-[#11302E]/50">{new Date(ranAt).toLocaleTimeString('hu')}</span>}
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[#E1EAEA] bg-white">
            {checks.map((c) => (
              <div key={c.name} className="flex items-center gap-3 border-b border-[#F1F5F5] px-4 py-3 last:border-b-0">
                <span className="text-[16px]">{c.severity === 'pass' ? '✅' : c.severity === 'warn' ? '⚠️' : '❌'}</span>
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

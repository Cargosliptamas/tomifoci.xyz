'use client'

import { useEffect, useMemo, useState } from 'react'
import { MATCHES, flag } from '@/lib/fixtures'
import type { GameState } from '@/lib/types'

type Section = 'dash' | 'results'

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [section, setSection] = useState<Section>('dash')
  const [state, setState] = useState<GameState | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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
          {([['dash', '📊', 'Áttekintés'], ['results', '⚽', 'Eredmények']] as const).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-[11px] whitespace-nowrap rounded-[11px] px-[13px] py-[10px] text-left ${
                section === id ? 'bg-[#EBF6F5] font-black text-[#007E73]' : 'font-bold text-[#11302E]/65'
              }`}
            >
              <span className="text-[16px]">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* main */}
        <main className="px-[18px] py-[18px] lg:px-[30px] lg:py-[26px]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="eyebrow tracking-[0.12em] text-[#11302E]/50">Üzemeltetés</div>
              <h1 className="text-[23px] font-black">{section === 'dash' ? 'Áttekintés' : 'Eredmények & KO'}</h1>
            </div>
            <span className="mono rounded-[7px] border border-[#c2e6cf] bg-[#e4f5ea] px-[9px] py-[5px] text-[10px] font-bold text-[#15803d]">
              ● ÉLES
            </span>
          </div>

          {section === 'dash' && <Dashboard state={state} onRecompute={() => void loadState().then(() => showToast('✓ Állapot frissítve'))} />}
          {section === 'results' && <Results token={token} onSaved={(m) => void loadState().then(() => showToast(m))} />}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[70] -translate-x-1/2 rounded-[12px] bg-[#11302E] px-5 py-3 text-[13px] font-bold text-white shadow-[0_12px_30px_rgba(8,54,60,0.4)]">
          {toast}
        </div>
      )}
    </div>
  )
}

function Dashboard({ state, onRecompute }: { state: GameState | null; onRecompute: () => void }) {
  const players = state?.settings.players?.length ?? 0
  const predictions = state ? Object.values(state.predictions).reduce((n, m) => n + Object.keys(m).length, 0) : 0
  const results = state ? Object.keys(state.results).length : 0

  return (
    <>
      <div className="mb-[18px] grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Játékosok" value={players} />
        <Tile label="Tippek" value={predictions} />
        <Tile label="Eredmények" value={results} suffix="/104" />
        <Tile label="Adatbázis" value={state ? '✓' : '—'} />
      </div>
      <div className="rounded-[16px] border border-[#E1EAEA] bg-white p-4">
        <div className="text-xs font-black tracking-[0.08em] text-[#11302E]/55">RENDSZERÁLLAPOT</div>
        <Status label="Adatbázis (Neon)" ok={Boolean(state)} value={state ? 'kapcsolódva' : 'nincs kapcsolat'} />
        <Status label="Pontok forrása" ok value="élő újraszámítás" />
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
    </>
  )
}

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

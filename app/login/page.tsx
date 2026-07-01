'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { writeSession } from '@/lib/session'
import type { GameState } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [needsClaimCode, setNeedsClaimCode] = useState(false)
  const [pendingPin, setPendingPin] = useState('')
  const [claimCode, setClaimCode] = useState('')
  const [claimError, setClaimError] = useState<string | null>(null)

  function loadPlayers() {
    setLoadError(null)
    fetch('/api/state?community=hu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { ok: boolean; state?: GameState; error?: string }) => {
        if (json.ok && json.state)
          setPlayers((json.state.settings.players ?? []).map((p) => p.name).filter(Boolean))
        else setLoadError(json.error ?? 'load-failed')
      })
      .catch(() => setLoadError('offline'))
  }

  useEffect(loadPlayers, [])

  // Automated-test auto-login: /login?as=<name> logs straight in WITHOUT a PIN. The server
  // only honours this for the single TEST_LOGIN_USER (e.g. Firecrawl); for anyone else the
  // PIN-less request is rejected and we fall back to the normal flow.
  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get('as')
    if (!as) return
    void fetch('/api/auth/player-pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: as, pin: '0000', community: 'hu' })
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          writeSession({ player: as, pin: '0000', community: 'hu' })
          router.push('/meccsek')
        }
      })
      .catch(() => {})
  }, [router])

  const filtered = useMemo(
    () => players.filter((p) => p.toLowerCase().includes(search.toLowerCase())),
    [players, search]
  )

  async function submitPin(nextPin: string, code?: string) {
    if (!selected) return
    setBusy(true)
    setError(null)
    setClaimError(null)
    try {
      const body: Record<string, string> = { player: selected, pin: nextPin, community: 'hu' }
      if (code) body.claimCode = code
      const res = await fetch('/api/auth/player-pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json().catch(() => ({}))
      // ok => verified. auth-not-provisioned => no PINs seeded yet (dormant): allow in.
      if (json.ok || json.error === 'auth-not-provisioned') {
        writeSession({ player: selected, pin: nextPin, community: 'hu' })
        router.push('/meccsek')
        return
      }
      // claim-required => admin has set a claim code; show the claim code step.
      if (json.error === 'claim-required') {
        setPendingPin(nextPin)
        setNeedsClaimCode(true)
        return
      }
      if (needsClaimCode) {
        setClaimError('Hibás kód')
      } else {
        setError(json.error === 'bad-pin' ? 'Hibás PIN' : 'Hiba történt')
        setPin('')
      }
    } catch {
      setError('Nincs kapcsolat')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  async function submitWithClaimCode() {
    if (!selected || !pendingPin || !claimCode.trim()) return
    await submitPin(pendingPin, claimCode.trim())
  }

  function press(key: string) {
    if (busy) return
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    if (pin.length >= 4) return
    const next = pin + key
    setPin(next)
    if (next.length === 4) void submitPin(next)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[#EAF6F5] px-[18px] pb-10 pt-[22px]">
      <div className="mb-2 flex w-full max-w-[440px] items-center gap-[10px]">
        {selected ? (
          <button
            onClick={() => {
              if (needsClaimCode) {
                setNeedsClaimCode(false)
                setPendingPin('')
                setClaimCode('')
                setClaimError(null)
              } else {
                setSelected(null)
                setPin('')
                setError(null)
              }
            }}
            className="flex size-[38px] items-center justify-center rounded-[12px] bg-white text-[18px] shadow-[0_2px_8px_rgba(13,51,49,0.08)]"
          >
            ‹
          </button>
        ) : (
          <Link
            href="/"
            className="flex size-[38px] items-center justify-center rounded-[12px] bg-white text-[18px] shadow-[0_2px_8px_rgba(13,51,49,0.08)]"
          >
            ‹
          </Link>
        )}
        <span className="text-[15px] font-black">Ki vagy te?</span>
      </div>

      {!selected ? (
        <div className="animate-in w-full max-w-[440px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés a játékosok közt…"
            className="mb-[14px] w-full rounded-[14px] border border-[#DCEFEE] bg-white px-4 py-[13px] text-[15px] shadow-[0_2px_8px_rgba(13,51,49,0.04)] outline-none"
          />
          {loadError && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-[12px] bg-[#fff4e6] px-4 py-3 text-[13px] font-semibold text-[#9a6b00]">
              <span>Nem sikerült kapcsolódni. Ellenőrizd az internetkapcsolatot, és próbáld újra.</span>
              <button
                onClick={loadPlayers}
                className="tap flex-none rounded-full bg-white/60 px-3 py-1 text-[12px] font-black"
              >
                ⟳ újra
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-[10px]">
            {filtered.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setSelected(name)
                  setPin('')
                }}
                className="tap flex items-center gap-[11px] rounded-[14px] border border-[#DCEFEE] bg-white px-[13px] py-3 text-left shadow-[0_1px_3px_rgba(13,51,49,0.05)] hover:border-[#bfe4df]"
              >
                <span
                  className="flex size-9 items-center justify-center rounded-full text-[15px] font-black text-white"
                  style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)' }}
                >
                  {name[0]}
                </span>
                <span className="truncate text-[14px] font-bold text-[#0D3331]">{name}</span>
              </button>
            ))}
            {!filtered.length && !loadError && (
              <div className="col-span-2 py-8 text-center text-[13px] text-[#0D3331]/50">Nincs találat</div>
            )}
          </div>
        </div>
      ) : needsClaimCode ? (
        <div className="animate-in mt-[18px] flex w-full max-w-[340px] flex-col items-center">
          <span
            className="flex size-[72px] items-center justify-center rounded-full text-[30px] font-black text-white shadow-[0_10px_26px_rgba(0,184,169,0.3)]"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)' }}
          >
            {selected[0]}
          </span>
          <span className="mt-[14px] text-[19px] font-black">{selected}</span>
          <span className="mt-[2px] text-[13px] text-[#0D3331]/[0.62]">
            Add meg a meghívó kódot a belépéshez
          </span>
          <input
            type="text"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitWithClaimCode()}
            placeholder="Meghívó kód"
            autoFocus
            className="mt-[22px] w-full rounded-[14px] border border-[#DCEFEE] bg-white px-4 py-[13px] text-[15px] shadow-[0_2px_8px_rgba(13,51,49,0.04)] outline-none focus:border-[#007E73]"
          />
          {claimError && <span className="mt-2 text-[13px] font-bold text-[#FF3B30]">{claimError}</span>}
          <button
            onClick={() => void submitWithClaimCode()}
            disabled={busy || !claimCode.trim()}
            className="tap mt-[16px] w-full rounded-[14px] bg-[#007E73] py-[14px] text-[15px] font-black text-white disabled:opacity-40"
          >
            {busy ? '…' : 'Belépés'}
          </button>
        </div>
      ) : (
        <div className="animate-in mt-[18px] flex w-full max-w-[340px] flex-col items-center">
          <span
            className="flex size-[72px] items-center justify-center rounded-full text-[30px] font-black text-white shadow-[0_10px_26px_rgba(0,184,169,0.3)]"
            style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)' }}
          >
            {selected[0]}
          </span>
          <span className="mt-[14px] text-[19px] font-black">{selected}</span>
          <span className="mt-[2px] text-[13px] text-[#0D3331]/[0.62]">Add meg a 4 jegyű PIN-kódod</span>

          <div className="my-[22px] flex gap-[14px]">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="size-4 rounded-full"
                style={
                  i < pin.length
                    ? { background: '#007E73', boxShadow: '0 2px 6px rgba(0,126,115,0.4)' }
                    : { background: '#fff', border: '2px solid #DCEFEE' }
                }
              />
            ))}
          </div>
          {error && <span className="mb-2 text-[13px] font-bold text-[#FF3B30]">{error}</span>}

          <div className="mt-[14px] grid w-[240px] grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) =>
              key === '' ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  onClick={() => press(key)}
                  disabled={busy}
                  className={
                    key === 'del'
                      ? 'tap h-[60px] rounded-[16px] text-[21px] font-bold text-[#0D3331]/60 hover:text-[#0D3331]'
                      : 'tap h-[60px] rounded-[16px] bg-white text-[23px] font-extrabold text-[#0D3331] shadow-[0_1px_3px_rgba(13,51,49,0.05)] hover:bg-[#F7FBFA]'
                  }
                >
                  {key === 'del' ? '⌫' : key}
                </button>
              )
            )}
          </div>
          <span className="mt-[18px] text-xs text-[#0D3331]/50">
            🔒 Biometrikus belépés ezen az eszközön elérhető
          </span>
        </div>
      )}
    </div>
  )
}

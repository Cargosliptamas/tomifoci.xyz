'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { clearSession, readSession, writeSession, type Session } from '@/lib/session'
import { flag, GROUPS } from '@/lib/fixtures'
import { useEffect, useState } from 'react'

const ALL_TEAMS = Array.from(new Set(Object.values(GROUPS).flat())).sort((a, b) => a.localeCompare(b, 'hu'))

export default function ProfilPage() {
  const router = useRouter()
  const { state, session, setFavorite } = useGame()
  const me = session?.player ?? ''

  const score = me ? state?.scores?.[encodeClientKey(me)] : undefined
  const fav = me ? state?.favorites?.[encodeClientKey(me)] : undefined
  const favTeam = fav?.switched ? fav.newTeam || fav.team : fav?.team

  const tipRank = placeIn((state?.rankings?.[encodeClientKey('all_Mindenki')] ?? []).map((r) => r.name), me)
  const wizRank = placeIn((state?.wizardRankings ?? []).map((r) => r.name), me)
  const swissRank = placeIn((state?.swiss?.standings ?? []).map((r) => r.name), me)

  function logout() {
    clearSession()
    router.push('/')
  }

  return (
    <>
      <PageHeader eyebrow="Fiók" title="Profil" />
      <div className="mx-auto max-w-[600px] px-[18px] pt-4">
        <div
          className="mb-[14px] rounded-[20px] p-[22px] text-center text-white"
          style={{ background: 'linear-gradient(160deg,#0C4D49,#0F6A64)' }}
        >
          <span className="inline-flex size-[74px] items-center justify-center rounded-full border-2 border-white/30 bg-white/15 text-[30px] font-black">
            {me ? me[0] : '?'}
          </span>
          <div className="mt-[10px] text-[20px] font-black">{me || 'Vendég'}</div>
          <div className="mt-px text-xs font-bold" style={{ color: '#9fe6dd' }}>
            ⭐ Kedvenc: {favTeam ? `${favTeam} ${flag(favTeam)}` : 'nincs'}
          </div>
          <div className="mt-[18px] grid grid-cols-3 gap-[10px]">
            <RankTile label="🎯 TIPP" value={tipRank} />
            <RankTile label="🪄 WIZ" value={wizRank} />
            <RankTile label="♟ SVÁJCI" value={swissRank} />
          </div>
          <div className="mt-[14px] border-t border-white/[0.14] pt-3 text-xs font-semibold" style={{ color: '#cfeae8' }}>
            {Math.round(score?.pts ?? 0)} pont · {(score?.ppg ?? 0).toFixed(1)} PPG · {score?.exact ?? 0} telitalálat
          </div>
        </div>

        <FavoritePicker current={favTeam ?? null} onPick={setFavorite} />

        <div className="overflow-hidden rounded-[16px] bg-white surface-card">
          <NotificationsRow />
          <PinRow player={me} community={session?.community ?? 'hu'} />
          <LanguageRow session={session} />
          <CacheRow />
          <SettingsRow icon="📖" label="Szabályok" href="/szabalyok" />
        </div>

        <button
          onClick={logout}
          className="tap mt-4 w-full rounded-[14px] border border-[#f3c9c6] bg-white py-[14px] text-[14px] font-extrabold text-[#FF3B30] hover:bg-[#fff5f4]"
        >
          Kijelentkezés
        </button>
      </div>
    </>
  )
}

// Mirror of the server SCORE-11 window (CET kickoffs).
function favPhaseNow(): 'free' | 'once' | 'locked' {
  const now = Date.now()
  if (now < Date.UTC(2026, 5, 11, 19, 0, 0)) return 'free'
  if (now < Date.UTC(2026, 5, 28, 19, 0, 0)) return 'once'
  return 'locked'
}

function FavoritePicker({ current, onPick }: { current: string | null; onPick: (team: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const phase = favPhaseNow()
  const locked = phase === 'locked'

  async function pick(team: string) {
    setBusy(true)
    setMsg(null)
    const r = await onPick(team)
    setBusy(false)
    if (r.ok) {
      setOpen(false)
      setMsg(null)
    } else {
      setMsg(
        r.error === 'fav-locked'
          ? 'A kedvenc zárolva a kieséses szakaszban'
          : r.error === 'switch-used'
            ? 'Már elhasználtad az egy váltásodat'
            : r.error === 'auth-not-provisioned'
              ? 'Jelentkezz be újra'
              : r.error === 'bad-pin'
                ? 'Hibás PIN'
                : 'Mentés sikertelen'
      )
    }
  }

  return (
    <div className="mb-[14px] rounded-[16px] bg-white p-4 surface-card">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold">⭐ Kedvenc csapat</span>
        {locked ? (
          <span className="rounded-full bg-[#EBF0F0] px-2.5 py-1 text-[11px] font-bold text-[#0D3331]/55">🔒 zárolva</span>
        ) : (
          <button onClick={() => setOpen((v) => !v)} className="text-[12px] font-extrabold text-[#007E73]">
            {current ? `${current} ${flag(current)}` : 'Válassz'} {open ? '▲' : '▾'}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-[1.45] text-[#0D3331]/[0.62]">
        {locked
          ? 'A kieséses szakasz kezdetével a kedvenc véglegesen zárolva. A kedvenced meccsein dupla pont járt, továbbjutásért +3 bónusz.'
          : phase === 'once'
            ? 'A kieséses szakaszig még egyszer válthatsz — az új kedvenc a kieséstől kezd duplázni.'
            : 'A kedvenced meccsein dupla pont jár, továbbjutásért +3 bónusz. A csoportkör végéig szabadon válthatsz.'}
      </p>
      {msg && <div className="mt-2 text-[12px] font-bold text-[#FF3B30]">{msg}</div>}
      {open && !locked && (
        <div className="mt-3 grid max-h-[240px] grid-cols-2 gap-1.5 overflow-y-auto">
          {ALL_TEAMS.map((team) => (
            <button
              key={team}
              disabled={busy}
              onClick={() => pick(team)}
              className={`tap flex items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-[13px] font-bold ${
                team === current ? 'border-[#14a08c] bg-[rgba(20,160,140,0.1)]' : 'border-[#DCEFEE] bg-white hover:border-[#bfe4df]'
              }`}
            >
              <span>{flag(team)}</span>
              <span className="truncate">{team}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RankTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-white/10 px-1.5 py-3">
      <div className="text-[11px] font-extrabold" style={{ color: '#9fe6dd' }}>
        {label}
      </div>
      <div className="mt-px text-[20px] font-black">{value}</div>
    </div>
  )
}

function SettingsRow({
  icon,
  label,
  value,
  onClick,
  href,
  accessory,
  children
}: {
  icon: string
  label: string
  value?: string
  onClick?: () => void
  href?: string
  accessory?: React.ReactNode
  children?: React.ReactNode
}) {
  const headerCls = 'flex w-full items-center gap-[13px] px-4 py-[15px] text-left'
  const inner = (
    <>
      <span className="w-6 text-center text-[19px]">{icon}</span>
      <span className="flex-1 text-[14px] font-bold">{label}</span>
      {value && <span className="text-xs font-semibold text-[#0D3331]/50">{value}</span>}
      {accessory ?? <span className="text-[18px] text-[#0D3331]/30">›</span>}
    </>
  )
  return (
    <div className="border-b border-[#EBF6F5] last:border-b-0">
      {href ? (
        <Link href={href} className={`${headerCls} tap hover:bg-[#F7FBFA]`}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={`${headerCls} tap hover:bg-[#F7FBFA]`}>
          {inner}
        </button>
      ) : (
        <div className={headerCls}>{inner}</div>
      )}
      {children}
    </div>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full transition-colors ${
        on ? 'bg-[#00B8A9]' : 'bg-[#D5E4E2]'
      }`}
    >
      <span
        className={`inline-block size-[18px] rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </span>
  )
}

const PIN_INPUT_CLS =
  'w-full rounded-[10px] border border-[#DCEFEE] bg-white px-3 py-2.5 text-[15px] font-bold tracking-[0.3em] tabular-nums outline-none focus:border-[#14a08c]'

function PinRow({ player, community }: { player: string; community: 'hu' | 'en' }) {
  const [open, setOpen] = useState(false)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit() {
    setMsg(null)
    if (!/^\d{4}$/.test(newPin)) {
      setMsg({ ok: false, text: 'Az új PIN 4 számjegy legyen' })
      return
    }
    if (newPin !== confirm) {
      setMsg({ ok: false, text: 'A két új PIN nem egyezik' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ player, pin: oldPin, newPin, community })
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.ok) {
        // Keep the locally-stored PIN in sync so future writes authenticate.
        const s = readSession()
        if (s) writeSession({ ...s, pin: newPin })
        setMsg({ ok: true, text: 'PIN frissítve ✓' })
        setOldPin('')
        setNewPin('')
        setConfirm('')
      } else {
        setMsg({ ok: false, text: json.error === 'bad-pin' ? 'Hibás jelenlegi PIN' : 'Mentés sikertelen' })
      }
    } catch {
      setMsg({ ok: false, text: 'Hálózati hiba' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsRow
      icon="🔑"
      label="PIN módosítása"
      onClick={() => setOpen((v) => !v)}
      accessory={<span className="text-[14px] text-[#0D3331]/40">{open ? '▲' : '▾'}</span>}
    >
      {open && (
        <div className="space-y-2.5 px-4 pb-4">
          <input
            className={PIN_INPUT_CLS}
            inputMode="numeric"
            maxLength={4}
            placeholder="Jelenlegi PIN (ha van)"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <input
            className={PIN_INPUT_CLS}
            inputMode="numeric"
            maxLength={4}
            placeholder="Új PIN (4 számjegy)"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <input
            className={PIN_INPUT_CLS}
            inputMode="numeric"
            maxLength={4}
            placeholder="Új PIN újra"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          {msg && (
            <div className={`text-[12px] font-bold ${msg.ok ? 'text-[#007E73]' : 'text-[#FF3B30]'}`}>{msg.text}</div>
          )}
          <button
            type="button"
            disabled={busy || !player}
            onClick={submit}
            className="w-full rounded-[12px] bg-[#00B8A9] py-2.5 text-[13px] font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'Mentés…' : 'PIN mentése'}
          </button>
        </div>
      )}
    </SettingsRow>
  )
}

function NotificationsRow() {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [pref, setPref] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setPerm('unsupported')
      return
    }
    setPerm(Notification.permission)
    try {
      setPref(window.localStorage.getItem('tomifoci_notif_pref') === '1')
    } catch {
      // ignore
    }
  }, [])

  async function toggle() {
    if (perm === 'unsupported' || perm === 'denied') return
    if (perm !== 'granted') {
      const result = await Notification.requestPermission()
      setPerm(result)
      if (result === 'granted') {
        try {
          window.localStorage.setItem('tomifoci_notif_pref', '1')
        } catch {
          // ignore
        }
        setPref(true)
        // Reload so PwaRegister's subscribe flow runs with the now-granted permission.
        window.location.reload()
      }
      return
    }
    // Already granted — flip the local preference only.
    const next = !pref
    setPref(next)
    try {
      window.localStorage.setItem('tomifoci_notif_pref', next ? '1' : '0')
    } catch {
      // ignore
    }
  }

  const value =
    perm === 'unsupported'
      ? 'Nem támogatott'
      : perm === 'denied'
        ? 'Letiltva (böngésző)'
        : perm === 'granted'
          ? pref
            ? 'Bekapcsolva'
            : 'Kikapcsolva'
          : 'Kérj engedélyt'
  const on = perm === 'granted' && pref

  return (
    <SettingsRow
      icon="🔔"
      label="Értesítések"
      value={value}
      onClick={toggle}
      accessory={<Toggle on={on} />}
    />
  )
}

function LanguageRow({ session }: { session: Session | null }) {
  function switchLang() {
    if (!session) return
    const next: 'hu' | 'en' = session.community === 'en' ? 'hu' : 'en'
    writeSession({ ...session, community: next })
    window.location.reload()
  }
  const isEn = session?.community === 'en'
  return (
    <SettingsRow
      icon="🌐"
      label="Nyelv"
      value={isEn ? 'English' : 'Magyar'}
      onClick={switchLang}
      accessory={
        <span className="rounded-full bg-[#EBF0F0] px-2.5 py-1 text-[11px] font-extrabold text-[#007E73]">
          {isEn ? 'HU →' : 'EN →'}
        </span>
      }
    />
  )
}

function CacheRow() {
  const [busy, setBusy] = useState(false)

  async function clear() {
    setBusy(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // ignore
    }
    try {
      const keep = 'tomifoci_session'
      const toRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k !== keep) toRemove.push(k)
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k))
    } catch {
      // ignore
    }
    window.location.reload()
  }

  return (
    <SettingsRow
      icon="🧹"
      label="Gyorsítótár ürítése"
      value={busy ? 'Törlés…' : undefined}
      onClick={() => {
        if (!busy) void clear()
      }}
    />
  )
}

function placeIn(orderedNames: string[], me: string): string {
  const i = orderedNames.indexOf(me)
  return i >= 0 ? `${i + 1}.` : '–'
}

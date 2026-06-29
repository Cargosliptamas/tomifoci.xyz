'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { useGame } from '@/components/game-provider'
import { encodeClientKey } from '@/lib/keys'
import { clearSession } from '@/lib/session'
import { flag } from '@/lib/fixtures'

export default function ProfilPage() {
  const router = useRouter()
  const { state, session } = useGame()
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

        <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_4px_16px_rgba(13,51,49,0.06)]">
          <SettingsRow icon="⭐" label="Kedvenc csapat" value={favTeam ? `${favTeam} ${flag(favTeam)}` : 'nincs'} />
          <SettingsRow icon="🔔" label="Értesítések" value="Kezdés · Eredmény · Bónusz" />
          <SettingsRow icon="🔑" label="PIN módosítása" />
          <SettingsRow icon="🌐" label="Nyelv" value={session?.community === 'en' ? 'English' : 'Magyar'} />
          <SettingsRow icon="🧹" label="Gyorsítótár ürítése" />
        </div>

        <button
          onClick={logout}
          className="mt-4 w-full rounded-[14px] border border-[#f3c9c6] bg-white py-[14px] text-[14px] font-extrabold text-[#FF3B30]"
        >
          Kijelentkezés
        </button>
      </div>
    </>
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

function SettingsRow({ icon, label, value }: { icon: string; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-[13px] border-b border-[#EBF6F5] px-4 py-[15px] last:border-b-0">
      <span className="w-6 text-center text-[19px]">{icon}</span>
      <span className="flex-1 text-[14px] font-bold">{label}</span>
      {value && <span className="text-xs font-semibold text-[#0D3331]/50">{value}</span>}
      <span className="text-[18px] text-[#0D3331]/30">›</span>
    </div>
  )
}

function placeIn(orderedNames: string[], me: string): string {
  const i = orderedNames.indexOf(me)
  return i >= 0 ? `${i + 1}.` : '–'
}

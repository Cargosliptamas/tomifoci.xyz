'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/meccsek', icon: '⚽', label: 'Meccsek' },
  { href: '/tabella', icon: '🏆', label: 'Tabella' },
  { href: '/wizard', icon: '🪄', label: 'Wizard' },
  { href: '/parbaj', icon: '♟', label: 'Párbaj' },
  { href: '/profil', icon: '👤', label: 'Profil' }
] as const

export function PlayerNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#DCEFEE] bg-white/[0.92] px-[18px] pt-1.5 backdrop-blur-md lg:sticky lg:top-0 lg:h-[100dvh] lg:flex-col lg:gap-1 lg:border-r lg:border-t-0 lg:px-[14px] lg:py-[22px]"
      style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}
    >
      <div className="mb-2 hidden items-center gap-[9px] px-3 text-[16px] font-black lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={30} height={30} className="rounded-[7px]" />
        tomifoci<span style={{ color: '#007E73' }}>.xyz</span>
      </div>
      {NAV.map(({ href, icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[12px] px-1 py-2 lg:flex-none lg:flex-row lg:justify-start lg:gap-[14px] lg:px-[14px] lg:py-3 ${
              active ? 'font-black text-[#007E73]' : 'font-bold text-[#0D3331]/55'
            }`}
            style={active ? { background: 'rgba(0,184,169,0.12)' } : undefined}
          >
            <span className="text-[20px] lg:text-[18px]">{icon}</span>
            <span className="text-[10px] font-extrabold lg:text-[14px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

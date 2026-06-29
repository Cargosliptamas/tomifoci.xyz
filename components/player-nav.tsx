'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; icon: string; label: string; primary: boolean }

// Canonical classic order (desktop sidebar shows all 8 in this order):
// Tippjeim · Meccs Center · Ranglista · Wizard · Párbaj · Csoportok · Profilom · Szabályok
const NAV: NavItem[] = [
  { href: '/meccsek', icon: '✏️', label: 'Tippjeim', primary: true },
  { href: '/meccs-center', icon: '📺', label: 'Meccs Center', primary: true },
  { href: '/tabella', icon: '🏆', label: 'Ranglista', primary: true },
  { href: '/wizard', icon: '🧙', label: 'Wizard', primary: true },
  { href: '/parbaj', icon: '⚔️', label: 'Párbaj', primary: false },
  { href: '/csoportok', icon: '👥', label: 'Csoportok', primary: false },
  { href: '/profil', icon: '👤', label: 'Profilom', primary: false },
  { href: '/szabalyok', icon: 'ℹ️', label: 'Szabályok', primary: false }
]

const OVERFLOW = NAV.filter((n) => !n.primary)

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function PlayerNav() {
  const pathname = usePathname()
  const [drawer, setDrawer] = useState(false)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#DCEFEE] bg-white/[0.92] px-1.5 pt-1.5 backdrop-blur-md lg:sticky lg:top-0 lg:h-[100dvh] lg:flex-col lg:gap-1 lg:border-r lg:border-t-0 lg:px-[14px] lg:py-[22px]"
        style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-2 hidden items-center gap-[9px] px-3 text-[16px] font-black lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={30} className="rounded-[7px]" />
          tomifoci<span style={{ color: '#007E73' }}>.xyz</span>
        </div>

        {NAV.map(({ href, icon, label, primary }) => {
          const active = isActive(pathname, href)
          // Overflow items are hidden on the mobile bottom bar (shown via ☰ Több),
          // but always present in the desktop (lg) sidebar.
          const visibility = primary ? '' : 'hidden lg:flex'
          return (
            <Link
              key={href}
              href={href}
              className={`tap min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[12px] px-0.5 py-2 lg:flex-none lg:flex-row lg:justify-start lg:gap-[14px] lg:px-[14px] lg:py-3 ${primary ? 'flex' : visibility} ${
                active ? 'bg-[#EBF6F5] font-black text-[#007E73]' : 'font-bold text-[#0D3331]/55'
              }`}
            >
              <span className="text-[19px] leading-none lg:text-[18px]">{icon}</span>
              <span className="text-[10px] font-extrabold leading-none tracking-[-0.01em] lg:text-[14px]">{label}</span>
            </Link>
          )
        })}

        {/* ☰ Több — mobile only; opens the overflow drawer */}
        <button
          onClick={() => setDrawer(true)}
          className={`tap flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[12px] px-0.5 py-2 lg:hidden ${
            OVERFLOW.some((n) => isActive(pathname, n.href)) ? 'bg-[#EBF6F5] font-black text-[#007E73]' : 'font-bold text-[#0D3331]/55'
          }`}
        >
          <span className="text-[19px] leading-none">☰</span>
          <span className="text-[10px] font-extrabold leading-none tracking-[-0.01em]">Több</span>
        </button>
      </nav>

      {/* ── Overflow drawer (mobile) ── */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[rgba(8,54,60,0.5)] backdrop-blur-[3px] lg:hidden"
          onClick={() => setDrawer(false)}
        >
          <div
            className="w-full rounded-t-[22px] bg-white px-3 pt-3 shadow-[0_-10px_40px_rgba(8,54,60,0.4)]"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-[5px] w-[42px] rounded-full bg-[#DCEFEE]" />
            {OVERFLOW.map(({ href, icon, label }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawer(false)}
                  className={`tap flex min-h-[52px] items-center gap-[14px] rounded-[14px] px-4 py-3 text-[15px] ${
                    active ? 'bg-[#EBF6F5] font-black text-[#007E73]' : 'font-bold text-[#0D3331]/80'
                  }`}
                >
                  <span className="text-[20px] leading-none">{icon}</span>
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

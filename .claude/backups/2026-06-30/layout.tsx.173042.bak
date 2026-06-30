import type { ReactNode } from 'react'
import { GameProvider } from '@/components/game-provider'
import { PlayerNav } from '@/components/player-nav'
import { CacheBustBanner } from '@/components/cache-bust-banner'

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <GameProvider>
      <div className="mx-auto min-h-[100dvh] max-w-[1200px] bg-[#EAF6F5] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <PlayerNav />
        <main className="pb-[84px] lg:pb-12">
          <CacheBustBanner />
          {children}
        </main>
      </div>
    </GameProvider>
  )
}

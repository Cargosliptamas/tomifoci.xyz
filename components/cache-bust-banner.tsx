'use client'

import { useEffect, useState } from 'react'

const BANNER_KEY = 'cache_bust_v2'

export function CacheBustBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(BANNER_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(BANNER_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 bg-[#FFF3CD] px-4 py-3 text-[13px] font-semibold text-[#7A5800]">
      <span className="shrink-0 text-[16px]">⚠️</span>
      <span className="flex-1">
        Nagy frissítés érkezett — kérlek töröld a böngésző gyorsítótárát:{' '}
        <span className="font-black">Ctrl+Shift+R</span> (PC) vagy{' '}
        <span className="font-black">Cmd+Shift+R</span> (Mac), mobilon: hosszan nyomd a frissítés gombot.
      </span>
      <button
        onClick={dismiss}
        className="tap shrink-0 rounded-[8px] bg-[#7A5800]/10 px-3 py-1.5 text-[12px] font-black hover:bg-[#7A5800]/20"
      >
        Értettem
      </button>
    </div>
  )
}

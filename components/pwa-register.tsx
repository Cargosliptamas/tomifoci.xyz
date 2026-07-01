'use client'

import { useEffect } from 'react'

// Public VAPID key. Must match the server's VAPID_PUBLIC env var. This is the
// same key the classic game used; it is harmless to ship (it is public).
const FALLBACK_VAPID_PUBLIC =
  'BNKDsAWDclmPJS9ckfkyVu68Hew-l9YYyIF2iE3jGzkDo7OooVWNO4FzKlCgzSngTmQPzakrC-fKUsbKew7msOk'

const SESSION_KEY = 'tomifoci_session'

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function hasSession(): boolean {
  try {
    return Boolean(window.localStorage.getItem(SESSION_KEY))
  } catch {
    return false
  }
}

// Subscribe to push and POST the subscription to our API. Best-effort: any
// failure (no permission, no VAPID, network) is swallowed — push is dormant
// until the server side is configured.
async function maybeSubscribe(reg: ServiceWorkerRegistration): Promise<void> {
  if (!('PushManager' in window) || !('Notification' in window)) return
  // Only subscribe when the user has already granted permission. We never
  // auto-prompt aggressively here.
  if (Notification.permission !== 'granted') return
  if (!hasSession()) return

  try {
    const publicKey = await fetchVapidPublicKey()
    if (!publicKey) return
    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as BufferSource
      }))

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() })
    })
  } catch {
    // ignore — push stays dormant
  }
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/public-key', { cache: 'no-store' })
    const json = (await res.json()) as { ok?: boolean; publicKey?: string }
    return json.ok && json.publicKey ? json.publicKey : FALLBACK_VAPID_PUBLIC
  } catch {
    return FALLBACK_VAPID_PUBLIC
  }
}

export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        if (cancelled) return
        const ready = await navigator.serviceWorker.ready
        if (cancelled) return
        await maybeSubscribe(ready || reg)
      } catch {
        // registration failed (e.g. unsupported context) — ignore
      }
    }

    register()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}

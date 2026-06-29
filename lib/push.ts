// Web push helper — DORMANT by default.
//
// The 'web-push' npm package is intentionally NOT a dependency, and no VAPID
// keys are required to build or run. This module loads 'web-push' lazily via a
// dynamic import that swallows a missing-module error, and no-ops when either
// the package or the VAPID_PUBLIC / VAPID_PRIVATE env vars are absent. Push
// therefore stays completely dormant — and the build never breaks — until
// someone installs 'web-push' and sets the VAPID env vars.
//
// To activate later:
//   1. pnpm add web-push @types/web-push
//   2. Set VAPID_PUBLIC, VAPID_PRIVATE (and optionally VAPID_SUBJECT).
//   3. Stored subscriptions in imported_rows 'pushSubscriptions' will receive
//      notifications via sendPush().

import { getImportedRows } from './db'

export type PushSubscriptionJSON = {
  endpoint: string
  expirationTime?: number | null
  keys?: { p256dh?: string; auth?: string }
}

export type PushPayload = {
  title: string
  body?: string
  tag?: string
  url?: string
  actions?: Array<{ action: string; title: string }>
}

export type SendPushResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string }

const VAPID_PUBLIC = process.env.VAPID_PUBLIC ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@tomifoci.xyz'

// Lazily import 'web-push' if it happens to be installed; otherwise return null.
// The ignore comment keeps bundlers/type-checkers from hard-failing on the
// (intentionally) absent module.
async function loadWebPush(): Promise<any | null> {
  try {
    // @ts-ignore - 'web-push' is an optional, not-installed dependency
    const mod: any = await import('web-push').catch(() => null)
    return mod?.default ?? mod ?? null
  } catch {
    return null
  }
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE)
}

// Send a push payload to a single subscription. Returns false on any failure.
export async function sendPushTo(
  subscription: PushSubscriptionJSON,
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured()) return false
  const webpush = await loadWebPush()
  if (!webpush) return false
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    await webpush.sendNotification(subscription as any, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

// Broadcast a payload to every stored subscription. No-ops (ok:false) when push
// is not configured or 'web-push' is not installed.
export async function sendPush(payload: PushPayload): Promise<SendPushResult> {
  if (!isPushConfigured()) return { ok: false, error: 'push-not-configured' }
  const webpush = await loadWebPush()
  if (!webpush) return { ok: false, error: 'push-not-configured' }

  let rows: Array<Record<string, any>> = []
  try {
    rows = await getImportedRows('pushSubscriptions')
  } catch {
    return { ok: false, error: 'subscriptions-unavailable' }
  }

  let sent = 0
  let failed = 0
  for (const row of rows) {
    const sub = (row?.subscription ?? row) as PushSubscriptionJSON
    if (!sub?.endpoint) {
      failed++
      continue
    }
    const ok = await sendPushTo(sub, payload)
    if (ok) sent++
    else failed++
  }
  return { ok: true, sent, failed }
}

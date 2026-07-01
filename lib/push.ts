// Web push helper. Delivery is active when VAPID_PUBLIC and VAPID_PRIVATE are
// configured; otherwise sendPush() returns push-not-configured without failing
// the calling result/poll route.

import webpush, { type WebPushError } from 'web-push'
import { getSql } from './db'

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

export type SendPushResult = { ok: true; sent: number; failed: number } | { ok: false; error: string }

type StoredSubscription = { id: number; subscription: PushSubscriptionJSON }

export function isPushConfigured(): boolean {
  return Boolean(vapidPublic() && vapidPrivate())
}

// Send a push payload to a single subscription. Returns false on any failure.
export async function sendPushTo(subscription: PushSubscriptionJSON, payload: PushPayload): Promise<boolean> {
  if (!isPushConfigured()) return false
  try {
    webpush.setVapidDetails(vapidSubject(), vapidPublic(), vapidPrivate())
    await webpush.sendNotification(subscription as any, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

// Broadcast a payload to every stored subscription. No-ops (ok:false) when push
// is not configured. Expired browser subscriptions are removed on 404/410.
export async function sendPush(payload: PushPayload): Promise<SendPushResult> {
  if (!isPushConfigured()) return { ok: false, error: 'push-not-configured' }

  let rows: StoredSubscription[] = []
  try {
    rows = await loadSubscriptions()
  } catch {
    return { ok: false, error: 'subscriptions-unavailable' }
  }

  webpush.setVapidDetails(vapidSubject(), vapidPublic(), vapidPrivate())
  let sent = 0
  let failed = 0
  for (const row of rows) {
    const sub = row.subscription
    if (!sub?.endpoint) {
      failed++
      continue
    }
    try {
      await webpush.sendNotification(sub as any, JSON.stringify(payload))
      sent++
    } catch (error) {
      failed++
      if (isExpiredPushError(error)) await deleteSubscription(row.id)
    }
  }
  return { ok: true, sent, failed }
}

function vapidPublic(): string {
  return process.env.VAPID_PUBLIC ?? ''
}

function vapidPrivate(): string {
  return process.env.VAPID_PRIVATE ?? ''
}

function vapidSubject(): string {
  return process.env.VAPID_SUBJECT ?? 'mailto:admin@tomifoci.xyz'
}

async function loadSubscriptions(): Promise<StoredSubscription[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT id, payload
    FROM imported_rows
    WHERE table_name = 'pushSubscriptions'
    ORDER BY id ASC
  `) as Array<{ id: number; payload: Record<string, any> }>
  return rows
    .map((row) => ({
      id: row.id,
      subscription: (row.payload?.subscription ?? row.payload) as PushSubscriptionJSON
    }))
    .filter((row) => Boolean(row.subscription?.endpoint))
}

async function deleteSubscription(id: number): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM imported_rows WHERE id = ${id}`
}

function isExpiredPushError(error: unknown): boolean {
  const statusCode = (error as WebPushError | undefined)?.statusCode
  return statusCode === 404 || statusCode === 410
}

import { NextResponse } from 'next/server'
import { adminGuard, logTxn } from '@/lib/admin'
import { sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  title?: string
  body?: string
  url?: string
}

export async function POST(request: Request) {
  const denied = adminGuard(request)
  if (denied) return denied

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim() || 'Tomifoci 2026'
  const message = String(body.body ?? '').trim() || 'Teszt értesítés'
  const url = String(body.url ?? '').trim() || '/meccs-center'
  const push = await sendPush({
    title: title.slice(0, 100),
    body: message.slice(0, 240),
    tag: 'admin-test',
    url
  })

  await logTxn({
    type: 'push',
    label: push.ok
      ? `Push teszt elküldve: ${push.sent}/${push.sent + push.failed}`
      : `Push teszt sikertelen: ${push.error}`,
    path: 'push',
    after: push
  })

  return NextResponse.json(
    { ok: push.ok, push, error: push.ok ? undefined : push.error },
    { status: push.ok ? 200 : 503 }
  )
}

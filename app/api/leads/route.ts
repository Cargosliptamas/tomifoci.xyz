import { NextResponse } from 'next/server'
import { upsertImportedRow } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  name?: unknown
  contact?: unknown
  message?: unknown
  community?: unknown
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  const name = clean(body.name, 80)
  const contact = clean(body.contact, 120)
  const message = clean(body.message, 700)
  const community = body.community === 'en' ? 'en' : 'hu'

  if (!name || !contact) {
    return NextResponse.json({ ok: false, error: 'missing-fields' }, { status: 400 })
  }

  const ts = Date.now()
  const id = `${ts}:${crypto.randomUUID().slice(0, 8)}`
  await upsertImportedRow('interestLeads', id, {
    id,
    name,
    contact,
    message,
    community,
    ts,
    handled: false,
    source: 'landing'
  })

  return NextResponse.json({ ok: true, id })
}

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max)
}

import { NextResponse } from 'next/server'
import { createAdminSession, isAdminMfaEnabled, verifyAdminTotp } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  token?: string
  totp?: string
}

export async function POST(request: Request) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: 'admin-not-configured' }, { status: 503 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 })
  }

  if (String(body.token ?? '') !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const mfa = isAdminMfaEnabled()
  if (mfa && !verifyAdminTotp(body.totp)) {
    return NextResponse.json(
      { ok: false, error: body.totp ? 'bad-totp' : 'totp-required', mfa },
      { status: 401 }
    )
  }

  const session = createAdminSession()
  return NextResponse.json({ ok: true, mfa, session: session.token, expiresAt: session.expiresAt })
}

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC ?? ''
  return NextResponse.json({ ok: Boolean(publicKey), publicKey })
}

import { NextResponse } from 'next/server'
import { loadPlayerHistoryFromNeon } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const player = url.searchParams.get('player')?.trim()
  const community = url.searchParams.get('community') === 'en' ? 'en' : 'hu'
  const limit = Number(url.searchParams.get('limit') ?? 10)
  const offset = Number(url.searchParams.get('offset') ?? 0)

  if (!player) {
    return NextResponse.json({ ok: false, error: 'player-required' }, { status: 400 })
  }

  try {
    const history = await loadPlayerHistoryFromNeon({ player, community, limit, offset })
    return NextResponse.json({ ok: true, history }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    const status = message.includes('DATABASE_URL') ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

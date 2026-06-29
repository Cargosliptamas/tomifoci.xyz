import { NextResponse } from 'next/server'
import { loadPublicStateFromNeon } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public read model: the `game:state` shape, secrets already stripped in buildPublicState
// (INV-09: ls2Key / ls2Secret / adminTotp never leave the server).
export async function GET(request: Request) {
  const community = new URL(request.url).searchParams.get('community') === 'en' ? 'en' : 'hu'
  try {
    const state = await loadPublicStateFromNeon(community)
    return NextResponse.json({ ok: true, state })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    const status = message.includes('DATABASE_URL') ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

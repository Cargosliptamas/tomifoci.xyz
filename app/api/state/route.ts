import { NextResponse } from 'next/server'
import { loadPublicStateFromNeon } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Short in-memory cache: loadPublicStateFromNeon reads every table and recomputes all
// scores/wizard/swiss on each call, so a small TTL collapses repeated/concurrent reads
// (page loads, multiple users on one instance) into one computation. Writes surface within
// the TTL window — fine for a prediction game.
const TTL_MS = 8000
const cache = new Map<string, { ts: number; payload: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

// Public read model: the `game:state` shape, secrets already stripped in buildPublicState
// (INV-09: ls2Key / ls2Secret / adminTotp never leave the server).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const community = url.searchParams.get('community') === 'en' ? 'en' : 'hu'
  const player = url.searchParams.get('player')?.trim() || null
  const fresh = url.searchParams.get('fresh') === '1' // bypass cache after a write
  const cacheKey = player ? `${community}:${player}` : community

  const hit = cache.get(cacheKey)
  if (!fresh && hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json(hit.payload, { headers: { 'x-cache': 'hit' } })
  }

  try {
    // De-dupe concurrent recomputes for the same community.
    let p = inflight.get(cacheKey)
    if (!p) {
      p = loadPublicStateFromNeon(community, { player }).then((state) => ({ ok: true, state }))
      inflight.set(cacheKey, p)
      p.finally(() => inflight.delete(cacheKey))
    }
    const payload = await p
    cache.set(cacheKey, { ts: Date.now(), payload })
    return NextResponse.json(payload, { headers: { 'x-cache': 'miss' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    const status = message.includes('DATABASE_URL') ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

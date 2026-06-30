import { describe, it, expect, beforeEach, vi } from 'vitest'

// S1 regression: every PIN-checking endpoint shares ONE per-account brute-force lockout.
// We mock @/lib/db with an in-memory throttle store + a controllable PIN verifier so we can
// exercise verifyPlayerPinThrottled (used by favorites/predictions/wizard) without a DB.
const { store, verifyMock } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  verifyMock: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  // Minimal tagged-template emulator covering the two queries throttle.ts issues:
  // a single-key SELECT (readRecord) and a single-key DELETE (clearThrottle).
  getSql: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join(' ')
    const [table, key] = values as [string, string]
    const id = `${table}::${key}`
    if (q.includes('SELECT')) {
      const payload = store.get(id)
      return Promise.resolve(payload ? [{ payload }] : [])
    }
    if (q.includes('DELETE')) {
      store.delete(id)
      return Promise.resolve([])
    }
    return Promise.resolve([])
  },
  upsertImportedRow: (table: string, convexId: string, payload: unknown) => {
    store.set(`${table}::${convexId}`, payload)
    return Promise.resolve()
  },
  verifyPlayerPinInNeon: verifyMock
}))

// Imported AFTER the mock is registered so throttle.ts binds to the mocked db.
const { verifyPlayerPinThrottled } = await import('@/lib/throttle')

const req = () => new Request('http://localhost/api/test') // no x-forwarded-for → key = community:player

describe('verifyPlayerPinThrottled — shared brute-force lockout (S1)', () => {
  beforeEach(() => {
    store.clear()
    verifyMock.mockReset()
  })

  it('locks the account after repeated wrong PINs and stops consulting the verifier', async () => {
    verifyMock.mockResolvedValue({ ok: false, reason: 'bad-pin' })

    const results = []
    for (let i = 0; i < 7; i++) {
      results.push(await verifyPlayerPinThrottled(req(), 'Tomi', '0000', 'hu'))
    }

    // 5 free fails + the 6th that trips the lock are all 401 bad-pin.
    for (let i = 0; i < 6; i++) {
      expect(results[i]).toMatchObject({ ok: false, status: 401, error: 'bad-pin' })
    }
    // The 7th is refused BEFORE verification — the oracle is closed.
    expect(results[6]).toMatchObject({ ok: false, status: 429, error: 'too-many-attempts' })
    expect((results[6] as { retryAfterMs: number }).retryAfterMs).toBeGreaterThan(0)
    // Verifier was never called on the locked attempt → no PIN oracle once locked.
    expect(verifyMock).toHaveBeenCalledTimes(6)
  })

  it('does not throttle when no PIN is provisioned (nothing to brute-force)', async () => {
    verifyMock.mockResolvedValue({ ok: false, reason: 'player-pin-not-found' })

    for (let i = 0; i < 12; i++) {
      const r = await verifyPlayerPinThrottled(req(), 'Ghost', '0000', 'hu')
      expect(r).toMatchObject({ ok: false, status: 503, error: 'auth-not-provisioned' })
    }
    // Never locks; identical response every time leaks nothing.
    expect(verifyMock).toHaveBeenCalledTimes(12)
  })

  it('a correct PIN clears the lockout counter', async () => {
    verifyMock
      .mockResolvedValueOnce({ ok: false, reason: 'bad-pin' })
      .mockResolvedValueOnce({ ok: false, reason: 'bad-pin' })
      .mockResolvedValueOnce({ ok: false, reason: 'bad-pin' })
      .mockResolvedValueOnce({ ok: true, reason: 'ok' })

    await verifyPlayerPinThrottled(req(), 'Tomi', '0000', 'hu')
    await verifyPlayerPinThrottled(req(), 'Tomi', '0001', 'hu')
    await verifyPlayerPinThrottled(req(), 'Tomi', '0002', 'hu')
    const good = await verifyPlayerPinThrottled(req(), 'Tomi', '1234', 'hu')

    expect(good).toEqual({ ok: true })
    expect(store.has('authAttempts::hu:Tomi')).toBe(false) // record cleared
  })

  it('failures on different endpoints share one bucket (same key)', async () => {
    // Simulating favorites + predictions + wizard all hitting the same player: every call
    // routes through verifyPlayerPinThrottled with the same (community, player) key, so the
    // counts accumulate into a single lockout rather than 5-per-endpoint.
    verifyMock.mockResolvedValue({ ok: false, reason: 'bad-pin' })

    for (let i = 0; i < 6; i++) {
      await verifyPlayerPinThrottled(req(), 'Tomi', '0000', 'hu')
    }
    const next = await verifyPlayerPinThrottled(req(), 'Tomi', '9999', 'hu')
    expect(next).toMatchObject({ ok: false, status: 429, error: 'too-many-attempts' })
  })
})

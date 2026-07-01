import { afterEach, describe, expect, it } from 'vitest'
import { createAdminSession, totpAt, verifyAdminSession, verifyAdminTotp } from '../lib/admin-auth'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('admin auth helpers', () => {
  it('mints signed sessions that expire', () => {
    process.env.ADMIN_TOKEN = 'token-secret'
    const now = 1_700_000_000_000
    const session = createAdminSession(now)

    expect(verifyAdminSession(session.token, now + 1000)).toBe(true)
    expect(verifyAdminSession(session.token, session.expiresAt + 1)).toBe(false)
    expect(verifyAdminSession(`${session.token.slice(0, -1)}x`, now + 1000)).toBe(false)
  })

  it('verifies TOTP only when a TOTP secret is configured', () => {
    const now = 59_000
    process.env.ADMIN_TOTP_SECRET = '12345678901234567890'

    expect(totpAt('12345678901234567890', now)).toBe('287082')
    expect(verifyAdminTotp('287082', now, 0)).toBe(true)
    expect(verifyAdminTotp('000000', now, 0)).toBe(false)
  })

  it('treats missing TOTP secret as MFA disabled', () => {
    delete process.env.ADMIN_TOTP_SECRET
    expect(verifyAdminTotp(null)).toBe(true)
  })
})

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const TOTP_STEP_MS = 30_000

type SessionPayload = {
  iat: number
  exp: number
  nonce: string
}

export function isAdminMfaEnabled(): boolean {
  return Boolean(adminTotpSecret())
}

export function createAdminSession(now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + SESSION_TTL_MS
  const payload: SessionPayload = {
    iat: now,
    exp: expiresAt,
    nonce: randomBytes(12).toString('hex')
  }
  const encoded = base64urlEncode(JSON.stringify(payload))
  return { token: `${encoded}.${sign(encoded)}`, expiresAt }
}

export function verifyAdminSession(token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig || !safeEqual(sig, sign(encoded))) return false

  try {
    const payload = JSON.parse(base64urlDecode(encoded)) as Partial<SessionPayload>
    return typeof payload.exp === 'number' && payload.exp > now
  } catch {
    return false
  }
}

export function verifyAdminTotp(code: string | null | undefined, now = Date.now(), window = 1): boolean {
  const secret = adminTotpSecret()
  if (!secret) return true
  const normalized = String(code ?? '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false

  const key = decodeTotpSecret(secret)
  const counter = Math.floor(now / TOTP_STEP_MS)
  for (let offset = -window; offset <= window; offset++) {
    if (totpAtCounter(key, counter + offset) === normalized) return true
  }
  return false
}

export function totpAt(secret: string, now = Date.now()): string {
  return totpAtCounter(decodeTotpSecret(secret), Math.floor(now / TOTP_STEP_MS))
}

function adminTotpSecret(): string {
  return String(process.env.ADMIN_TOTP_SECRET ?? '').trim()
}

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN
  if (!secret) throw new Error('ADMIN_TOKEN not set')
  return secret
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', sessionSecret()).update(encodedPayload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

function base64urlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function decodeTotpSecret(secret: string): Buffer {
  const rawSecret = secret.includes('secret=')
    ? (new URL(secret).searchParams.get('secret') ?? secret)
    : secret
  const clean = rawSecret.replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase()
  if (!/^[A-Z2-7]+$/.test(clean)) return Buffer.from(secret, 'utf8')

  let bits = ''
  for (const char of clean) {
    const val = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char)
    if (val < 0) return Buffer.from(secret, 'utf8')
    bits += val.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function totpAtCounter(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8)
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  msg.writeUInt32BE(counter >>> 0, 4)
  const digest = createHmac('sha1', secret).update(msg).digest()
  const offset = digest[digest.length - 1] & 0xf
  const bin =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}

export type BioKind = 'player' | 'admin'

type BioRecord = {
  id: string
  t: number
  label: string
}

function bioKey(kind: BioKind, name: string, community: 'hu' | 'en') {
  return `tomifoci_bio_${community}_${kind}_${name || 'admin'}`
}

function bioPinKey(kind: BioKind, name: string, community: 'hu' | 'en') {
  return `tomifoci_bio_pin_${community}_${kind}_${name || 'admin'}`
}

export function bioSupported() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    crypto?.getRandomValues
  )
}

export function bioHas(kind: BioKind, name: string, community: 'hu' | 'en' = 'hu') {
  if (typeof window === 'undefined') return false
  try {
    const rec = JSON.parse(
      window.localStorage.getItem(bioKey(kind, name, community)) || 'null'
    ) as BioRecord | null
    return Boolean(rec?.id)
  } catch {
    return false
  }
}

export function storeBioPin(kind: BioKind, name: string, community: 'hu' | 'en', pin: string) {
  if (typeof window === 'undefined' || !/^\d{4}$/.test(pin)) return
  window.localStorage.setItem(bioPinKey(kind, name, community), pin)
}

export function readBioPin(kind: BioKind, name: string, community: 'hu' | 'en' = 'hu') {
  if (typeof window === 'undefined') return null
  const pin = window.localStorage.getItem(bioPinKey(kind, name, community))
  return pin && /^\d{4}$/.test(pin) ? pin : null
}

export async function bioRegister(kind: BioKind, name: string, label: string, community: 'hu' | 'en' = 'hu') {
  if (!bioSupported()) throw new Error('Ez a böngésző nem támogatja a Face ID / Touch ID belépést')
  const userId = new TextEncoder().encode(`${community}:${kind}:${name || 'admin'}`)
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Tomifoci' },
      user: { id: userId, name: label || name || 'Admin', displayName: label || name || 'Admin' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60_000,
      attestation: 'none'
    }
  })
  if (!credential) throw new Error('Biometrikus regisztráció megszakítva')
  const publicKeyCredential = credential as PublicKeyCredential
  window.localStorage.setItem(
    bioKey(kind, name, community),
    JSON.stringify({
      id: base64Url(new Uint8Array(publicKeyCredential.rawId)),
      t: Date.now(),
      label: label || name || 'Admin'
    })
  )
}

export async function bioUnlock(kind: BioKind, name: string, community: 'hu' | 'en' = 'hu') {
  if (!bioSupported()) throw new Error('Ez a böngésző nem támogatja a Face ID / Touch ID belépést')
  const raw = window.localStorage.getItem(bioKey(kind, name, community))
  const rec = raw ? (JSON.parse(raw) as BioRecord) : null
  if (!rec?.id) throw new Error('Nincs beállított biometrikus belépés ezen az eszközön')
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ type: 'public-key', id: base64UrlDecode(rec.id) }],
      userVerification: 'required',
      timeout: 60_000
    }
  })
  if (!credential) throw new Error('Biometrikus ellenőrzés megszakítva')
}

function randomChallenge() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes
}

function base64Url(bytes: Uint8Array) {
  let s = ''
  bytes.forEach((byte) => {
    s += String.fromCharCode(byte)
  })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string) {
  let s = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

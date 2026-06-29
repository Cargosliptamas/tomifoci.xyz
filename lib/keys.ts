// Client-safe key encoder. Player names with non-alphanumeric chars (Hungarian accents)
// are encoded to `q_<hex>` so they can be object keys in the game:state payload.
// MUST match the encoding used server-side in client-state.ts.
export function encodeClientKey(value: string): string {
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(value)) return value
  return `q_${Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

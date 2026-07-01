export function isFinalLiveStatus(status: unknown): boolean {
  const value = String(status ?? '')
    .trim()
    .toUpperCase()
  return value === 'FT' || value === 'FINISHED' || value === 'FULL TIME' || value === 'FULLTIME'
}

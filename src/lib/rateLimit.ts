const WINDOW_MS = 60_000
const store = new Map<string, number[]>()

function getLimit(): number {
  return parseInt(process.env.CTHRU_RATE_LIMIT ?? '100', 10)
}

export function isRateLimited(key: string): boolean {
  const now = Date.now()
  const limit = getLimit()
  const timestamps = (store.get(key) ?? []).filter(t => now - t < WINDOW_MS)
  timestamps.push(now)
  store.set(key, timestamps)
  return timestamps.length > limit
}

export function resetRateLimit(key?: string): void {
  if (key) store.delete(key)
  else store.clear()
}

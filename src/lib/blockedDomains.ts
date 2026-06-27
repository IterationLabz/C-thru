import { db } from './db'
import { refreshBlockedDomains } from './domainClassifier'

export async function listBlockedDomains(): Promise<string[]> {
  const { rows } = await db.query<{ domain: string }>(
    `SELECT domain FROM blocked_domains ORDER BY domain`
  )
  return rows.map(r => r.domain)
}

export async function addBlockedDomain(domain: string): Promise<void> {
  const normalized = domain.trim().toLowerCase()
  if (!normalized) throw new Error('domain cannot be empty')
  if (!normalized.includes('.')) throw new Error('domain must contain a dot')
  await db.query(
    `INSERT INTO blocked_domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING`,
    [normalized]
  )
  await refreshBlockedDomains()
}

export async function removeBlockedDomain(domain: string): Promise<void> {
  await db.query(`DELETE FROM blocked_domains WHERE domain = $1`, [domain.trim().toLowerCase()])
  await refreshBlockedDomains()
}

import { db } from './db'

let blockedSet: Set<string> | null = null

export async function refreshBlockedDomains(): Promise<void> {
  const { rows } = await db.query('SELECT domain FROM blocked_domains')
  blockedSet = new Set(rows.map((r: { domain: string }) => r.domain.toLowerCase()))
}

async function getBlockedSet(): Promise<Set<string>> {
  if (!blockedSet) await refreshBlockedDomains()
  return blockedSet!
}

export async function classifyDomain(email: string): Promise<{ companyDomain: string | null }> {
  if (!email.includes('@')) return { companyDomain: null }

  const domain = email.split('@')[1].toLowerCase()
  const blocked = await getBlockedSet()

  if (blocked.has(domain)) return { companyDomain: null }
  return { companyDomain: domain }
}

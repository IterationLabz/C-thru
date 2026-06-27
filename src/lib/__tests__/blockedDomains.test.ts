import { describe, it, expect } from 'vitest'
import { listBlockedDomains, addBlockedDomain, removeBlockedDomain } from '../blockedDomains'
import { classifyDomain, refreshBlockedDomains } from '../domainClassifier'

describe('blocked domains CRUD', () => {
  it('returns the seeded list (non-empty)', async () => {
    const result = await listBlockedDomains()
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('gmail.com')
    expect(result).toContain('yahoo.com')
  })

  it('adds a domain and it appears in the list', async () => {
    await addBlockedDomain('testblock.com')
    const result = await listBlockedDomains()
    expect(result).toContain('testblock.com')
  })

  it('lowercases the domain on add', async () => {
    await addBlockedDomain('UPPER.COM')
    const result = await listBlockedDomains()
    expect(result).toContain('upper.com')
  })

  it('is idempotent — adding the same domain twice does not throw', async () => {
    await addBlockedDomain('dup.com')
    await expect(addBlockedDomain('dup.com')).resolves.toBeUndefined()
    const result = await listBlockedDomains()
    expect(result.filter(d => d === 'dup.com').length).toBe(1)
  })

  it('updates the in-memory classifier cache after add', async () => {
    await refreshBlockedDomains() // reset cache to current DB state
    await addBlockedDomain('newblocked.io')
    // classifyDomain should now see newblocked.io as blocked
    const result = await classifyDomain('user@newblocked.io')
    expect(result.companyDomain).toBeNull()
  })

  it('removes a domain from the list', async () => {
    await addBlockedDomain('toremove.com')
    await removeBlockedDomain('toremove.com')
    const result = await listBlockedDomains()
    expect(result).not.toContain('toremove.com')
  })

  it('updates the in-memory classifier cache after remove', async () => {
    // acme123.com is not a pre-seeded blocked domain
    await addBlockedDomain('acme123.com')
    await removeBlockedDomain('acme123.com')
    // classifyDomain should now treat it as a company domain again
    const result = await classifyDomain('user@acme123.com')
    expect(result.companyDomain).toBe('acme123.com')
  })

  it('removing a non-existent domain does not throw', async () => {
    await expect(removeBlockedDomain('nothere.com')).resolves.toBeUndefined()
  })

  it('rejects an empty domain', async () => {
    await expect(addBlockedDomain('')).rejects.toThrow()
  })

  it('rejects a domain with no dot', async () => {
    await expect(addBlockedDomain('nodot')).rejects.toThrow()
  })
})

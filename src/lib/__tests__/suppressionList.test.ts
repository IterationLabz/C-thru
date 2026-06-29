import { describe, it, expect } from 'vitest'
import { addSuppression, listSuppressions, removeSuppression, isSuppressed } from '../suppressionList'
import { db } from '../db'

describe('suppressionList — CRUD', () => {
  it('addSuppression inserts a domain entry', async () => {
    await addSuppression('domain', 'blocked.com')
    const all = await listSuppressions()
    const entry = all.find(s => s.value === 'blocked.com')
    expect(entry).toBeDefined()
    expect(entry!.entry_type).toBe('domain')
    expect(entry!.removed_at).toBeNull()
  })

  it('addSuppression inserts an email entry', async () => {
    await addSuppression('email', 'noreply@blocked.com')
    const all = await listSuppressions()
    expect(all.some(s => s.value === 'noreply@blocked.com')).toBe(true)
  })

  it('addSuppression normalises to lowercase', async () => {
    await addSuppression('email', 'UPPER@CASE.COM')
    const all = await listSuppressions()
    expect(all.some(s => s.value === 'upper@case.com')).toBe(true)
  })

  it('addSuppression is idempotent — no duplicate on repeat insert', async () => {
    await addSuppression('domain', 'dedupe.com')
    await addSuppression('domain', 'dedupe.com')
    const all = await listSuppressions()
    expect(all.filter(s => s.value === 'dedupe.com')).toHaveLength(1)
  })
})

describe('suppressionList — soft-delete (D-29)', () => {
  it('removeSuppression sets removed_at, preserving the row', async () => {
    await addSuppression('domain', 'softdel.com')
    const before = await listSuppressions()
    const entry = before.find(s => s.value === 'softdel.com')!
    expect(entry.removed_at).toBeNull()

    await removeSuppression(entry.id)

    const { rows } = await db.query<{ removed_at: Date | null }>(
      `SELECT removed_at FROM suppression_list WHERE id = $1`,
      [entry.id]
    )
    // Row still exists (compliance audit trail)
    expect(rows).toHaveLength(1)
    // But removed_at is now set
    expect(rows[0]!.removed_at).not.toBeNull()
  })

  it('removeSuppression does NOT hard-delete the row', async () => {
    await addSuppression('email', 'audit@trail.com')
    const [entry] = (await listSuppressions()).filter(s => s.value === 'audit@trail.com')
    await removeSuppression(entry!.id)

    const { rows } = await db.query(
      `SELECT * FROM suppression_list WHERE id = $1`,
      [entry!.id]
    )
    expect(rows).toHaveLength(1) // row still exists
  })
})

describe('isSuppressed — domain and email matching', () => {
  it('returns true when the domain is suppressed', async () => {
    await addSuppression('domain', 'suppressed.io')
    expect(await isSuppressed('suppressed.io')).toBe(true)
  })

  it('returns true when the email matches a suppressed email entry', async () => {
    await addSuppression('email', 'opt-out@company.com')
    expect(await isSuppressed('company.com', 'opt-out@company.com')).toBe(true)
  })

  it('returns false when neither domain nor email is suppressed', async () => {
    expect(await isSuppressed('fine.com', 'ok@fine.com')).toBe(false)
  })

  it('returns false after an entry is soft-deleted', async () => {
    await addSuppression('domain', 'removed.com')
    const [entry] = (await listSuppressions()).filter(s => s.value === 'removed.com')
    await removeSuppression(entry!.id)
    expect(await isSuppressed('removed.com')).toBe(false)
  })

  it('returns false when domain is suppressed but a different email is checked (no false positive)', async () => {
    await addSuppression('email', 'specific@company.com')
    // A different email at the same domain is NOT blocked by an email-type suppression
    expect(await isSuppressed('company.com', 'other@company.com')).toBe(false)
  })
})

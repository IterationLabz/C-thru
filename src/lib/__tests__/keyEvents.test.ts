import { describe, it, expect } from 'vitest'
import { listKeyEvents, addKeyEvent, deleteKeyEvent } from '../keyEvents'

describe('key events CRUD', () => {
  it('returns empty list when no key events exist', async () => {
    const result = await listKeyEvents()
    expect(result).toEqual([])
  })

  it('adds a key event and it appears in the list', async () => {
    await addKeyEvent('payment_succeeded')
    const result = await listKeyEvents()
    expect(result.map(e => e.name)).toContain('payment_succeeded')
  })

  it('stores created_at on insert', async () => {
    await addKeyEvent('signup_completed')
    const result = await listKeyEvents()
    const event = result.find(e => e.name === 'signup_completed')
    expect(event?.createdAt).toBeInstanceOf(Date)
  })

  it('lists events in created_at descending order', async () => {
    await addKeyEvent('first_event')
    await addKeyEvent('second_event')
    const result = await listKeyEvents()
    const names = result.map(e => e.name)
    expect(names.indexOf('second_event')).toBeLessThan(names.indexOf('first_event'))
  })

  it('is idempotent — adding the same name twice does not throw', async () => {
    await addKeyEvent('dedup_event')
    await expect(addKeyEvent('dedup_event')).resolves.toBeUndefined()
    const result = await listKeyEvents()
    expect(result.filter(e => e.name === 'dedup_event').length).toBe(1)
  })

  it('deletes a key event by name', async () => {
    await addKeyEvent('to_delete')
    await deleteKeyEvent('to_delete')
    const result = await listKeyEvents()
    expect(result.map(e => e.name)).not.toContain('to_delete')
  })

  it('deleting a non-existent name does not throw', async () => {
    await expect(deleteKeyEvent('does_not_exist')).resolves.toBeUndefined()
  })

  it('rejects an empty name', async () => {
    await expect(addKeyEvent('')).rejects.toThrow()
  })

  it('rejects a name longer than 200 characters', async () => {
    await expect(addKeyEvent('a'.repeat(201))).rejects.toThrow()
  })
})

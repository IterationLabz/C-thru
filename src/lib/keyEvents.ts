import { db } from './db'

export interface KeyEvent {
  name: string
  createdAt: Date
}

export async function listKeyEvents(): Promise<KeyEvent[]> {
  const { rows } = await db.query<{ name: string; created_at: Date }>(
    `SELECT name, created_at FROM key_events ORDER BY created_at DESC`
  )
  return rows.map(r => ({ name: r.name, createdAt: r.created_at }))
}

export async function addKeyEvent(name: string): Promise<void> {
  if (!name || name.trim().length === 0) throw new Error('key event name cannot be empty')
  if (name.length > 200) throw new Error('key event name cannot exceed 200 characters')
  await db.query(
    `INSERT INTO key_events (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [name.trim()]
  )
}

export async function deleteKeyEvent(name: string): Promise<void> {
  await db.query(`DELETE FROM key_events WHERE name = $1`, [name])
}

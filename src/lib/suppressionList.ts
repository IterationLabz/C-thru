import { db } from './db'

export interface SuppressionEntry {
  id: number
  entry_type: 'domain' | 'email'
  value: string
  created_at: Date
  removed_at: Date | null
}

export async function listSuppressions(): Promise<SuppressionEntry[]> {
  const { rows } = await db.query<SuppressionEntry>(
    `SELECT id, entry_type, value, created_at, removed_at
     FROM suppression_list
     ORDER BY created_at DESC`
  )
  return rows
}

export async function addSuppression(entry_type: 'domain' | 'email', value: string): Promise<void> {
  const normalised = value.toLowerCase().trim()
  await db.query(
    `INSERT INTO suppression_list (entry_type, value) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [entry_type, normalised]
  )
}

// Soft-delete — preserves compliance audit trail (D-29).
export async function removeSuppression(id: number): Promise<void> {
  await db.query(
    `UPDATE suppression_list SET removed_at = NOW() WHERE id = $1 AND removed_at IS NULL`,
    [id]
  )
}

export async function isSuppressed(domain: string, email?: string | null): Promise<boolean> {
  const values: string[] = [domain.toLowerCase()]
  if (email) values.push(email.toLowerCase())

  const { rows } = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM suppression_list
     WHERE removed_at IS NULL
       AND value = ANY($1::text[])`,
    [values]
  )
  return Number(rows[0]?.cnt ?? 0) > 0
}

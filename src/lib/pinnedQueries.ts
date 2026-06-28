import { db } from './db'

export interface PinnedQuery {
  id: number
  question: string
  sql: string
  pinnedAt: Date
}

type Row = { id: number; question: string; sql: string; pinned_at: Date }

export async function pinQuery(question: string, sql: string): Promise<PinnedQuery> {
  const { rows } = await db.query<Row>(
    'INSERT INTO pinned_queries (question, sql) VALUES ($1, $2) RETURNING *',
    [question, sql]
  )
  return toModel(rows[0]!)
}

export async function listPinnedQueries(): Promise<PinnedQuery[]> {
  const { rows } = await db.query<Row>(
    'SELECT * FROM pinned_queries ORDER BY pinned_at ASC'
  )
  return rows.map(toModel)
}

export async function unpinQuery(id: number): Promise<void> {
  await db.query('DELETE FROM pinned_queries WHERE id = $1', [id])
}

function toModel(row: Row): PinnedQuery {
  return { id: row.id, question: row.question, sql: row.sql, pinnedAt: row.pinned_at }
}

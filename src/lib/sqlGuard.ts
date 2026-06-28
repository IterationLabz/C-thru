import { parse, Statement } from 'pgsql-ast-parser'
import { db } from './db'

export interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
  sql: string
}

const STATEMENT_TIMEOUT_MS = 5000
const DEFAULT_LIMIT = 500

const ALLOWED_VIEWS = new Set([
  'signups_v',
  'active_users_v',
  'company_activity_v',
  'events_v',
])

export async function validateAndRun(sql: string): Promise<QueryResult> {
  validateSql(sql)

  const limitedSql = /\blimit\b/i.test(sql) ? sql : `${sql}\nLIMIT ${DEFAULT_LIMIT}`

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE cthru_readonly')
    await client.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}'`)
    const result = await client.query(limitedSql)
    await client.query('ROLLBACK')
    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? result.rows.length,
      sql: limitedSql,
    }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* best effort */ }
    throw e
  } finally {
    client.release()
  }
}

export function validateSql(sql: string): string {
  let stmts: Statement[]
  try {
    stmts = parse(sql)
  } catch (e) {
    throw new Error(`SQL parse error: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (stmts.length === 0) throw new Error('SQL is empty')
  if (stmts.length > 1) throw new Error('Only a single SELECT statement is allowed')

  const stmt = stmts[0]!
  validateStatement(stmt)
  return sql
}

function validateStatement(stmt: Statement): void {
  if (stmt.type === 'with') {
    const cteAliases = new Set(stmt.bind.map(b => b.alias.name))

    for (const binding of stmt.bind) {
      if (binding.statement.type !== 'select') {
        throw new Error(`CTE "${binding.alias.name}" must be a SELECT, not ${binding.statement.type.toUpperCase()}`)
      }
      collectTableNames(binding.statement).forEach(n => assertAllowedView(n, cteAliases))
    }

    if (stmt.in.type !== 'select') {
      throw new Error(`WITH statement body must be a SELECT, not ${stmt.in.type.toUpperCase()}`)
    }
    collectTableNames(stmt.in).forEach(n => assertAllowedView(n, cteAliases))
    return
  }

  if (stmt.type !== 'select') {
    throw new Error(`Only SELECT is allowed, got ${stmt.type.toUpperCase()}`)
  }

  collectTableNames(stmt).forEach(n => assertAllowedView(n))
}

function assertAllowedView(name: string, cteAliases?: Set<string>): void {
  if (cteAliases?.has(name)) return
  if (!ALLOWED_VIEWS.has(name)) {
    throw new Error(`Table or view "${name}" is not in the allowed query surface`)
  }
}

function collectTableNames(stmt: Statement): string[] {
  const names: string[] = []
  collectFromNode(stmt, names)
  return names
}

function collectFromNode(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return

  const n = node as Record<string, unknown>

  // Table reference: { type: 'table', name: { name: '...' } }
  if (n['type'] === 'table' && n['name'] && typeof (n['name'] as Record<string, unknown>)['name'] === 'string') {
    out.push((n['name'] as Record<string, unknown>)['name'] as string)
    return
  }

  for (const val of Object.values(n)) {
    if (Array.isArray(val)) {
      for (const item of val) collectFromNode(item, out)
    } else if (val && typeof val === 'object') {
      collectFromNode(val, out)
    }
  }
}

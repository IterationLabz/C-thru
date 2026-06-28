import { describe, it, expect } from 'vitest'
import { validateSql } from '../sqlGuard'

describe('validateSql', () => {
  it('returns SQL unchanged for a valid SELECT against an allowed view', () => {
    const sql = 'SELECT COUNT(*) FROM signups_v'
    expect(validateSql(sql)).toBe(sql)
  })

  it('rejects INSERT', () => {
    expect(() => validateSql("INSERT INTO users (email) VALUES ('x@x.com')"))
      .toThrow('Only SELECT is allowed')
  })

  it('rejects UPDATE', () => {
    expect(() => validateSql("UPDATE users SET email = 'x@x.com'"))
      .toThrow('Only SELECT is allowed')
  })

  it('rejects DELETE', () => {
    expect(() => validateSql('DELETE FROM users'))
      .toThrow('Only SELECT is allowed')
  })

  it('rejects multiple statements', () => {
    expect(() => validateSql('SELECT 1; DROP TABLE users'))
      .toThrow('single SELECT statement')
  })

  it('rejects a query against a non-allowed table', () => {
    expect(() => validateSql('SELECT * FROM users'))
      .toThrow('"users" is not in the allowed query surface')
  })

  it('rejects a raw events table (not the view)', () => {
    expect(() => validateSql('SELECT * FROM events'))
      .toThrow('"events" is not in the allowed query surface')
  })

  it('accepts SELECT across all four allowed views', () => {
    const sql = `
      SELECT s.user_id, a.last_event_at
      FROM signups_v s
      JOIN active_users_v a ON s.user_id = a.user_id
    `
    expect(validateSql(sql)).toBe(sql)
  })

  it('accepts a CTE where all parts are SELECT and reference allowed views', () => {
    const sql = `
      WITH recent AS (
        SELECT user_id FROM active_users_v WHERE last_event_at > NOW() - INTERVAL '7 days'
      )
      SELECT COUNT(*) FROM recent
    `
    expect(validateSql(sql)).toBe(sql)
  })

  it('rejects a CTE that contains DML', () => {
    expect(() => validateSql(
      "WITH x AS (DELETE FROM users) SELECT * FROM x"
    )).toThrow('must be a SELECT')
  })

  it('rejects a subquery that references a non-allowed table', () => {
    expect(() => validateSql(
      'SELECT * FROM (SELECT * FROM users) sub'
    )).toThrow('"users" is not in the allowed query surface')
  })

  it('rejects unparseable SQL', () => {
    expect(() => validateSql('THIS IS NOT SQL @@##')).toThrow('SQL parse error')
  })

  it('accepts events_v (the allowed view)', () => {
    const sql = 'SELECT event_name, COUNT(*) FROM events_v GROUP BY event_name'
    expect(validateSql(sql)).toBe(sql)
  })

  it('rejects company_activity with a non-allowed join', () => {
    expect(() => validateSql(
      'SELECT * FROM company_activity_v JOIN raw_table ON true'
    )).toThrow('"raw_table" is not in the allowed query surface')
  })
})

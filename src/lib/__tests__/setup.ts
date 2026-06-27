import { afterEach, afterAll, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'

const adminPool = new Pool({
  connectionString: 'postgres://cthru:cthru@localhost:5433/postgres',
})

let testPool: Pool

beforeAll(async () => {
  await adminPool.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'cthru_test' AND pid <> pg_backend_pid()
  `)
  const exists = await adminPool.query(
    `SELECT 1 FROM pg_database WHERE datname = 'cthru_test'`
  )
  if (exists.rows.length === 0) {
    await adminPool.query('CREATE DATABASE cthru_test')
  }
  await adminPool.end()

  testPool = new Pool({
    connectionString: 'postgres://cthru:cthru@localhost:5433/cthru_test',
  })

  // Run all migrations in filename order
  const migrationsDir = join(process.cwd(), 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    await testPool.query(sql)
  }

  await testPool.end()
})

afterEach(async () => {
  const { db } = await import('../db')
  await db.query('TRUNCATE TABLE events, users, companies, aliases, key_events, blocked_domains RESTART IDENTITY')
  // Re-seed blocked_domains from migration
  const seedSql = readFileSync(join(process.cwd(), 'migrations', '002_blocked_domains.sql'), 'utf-8')
  await db.query(seedSql)
  // Reset in-memory domain classifier cache to reflect restored seed data
  const { refreshBlockedDomains } = await import('../domainClassifier')
  await refreshBlockedDomains()
  const { resetRateLimit } = await import('../rateLimit')
  resetRateLimit()
})

afterAll(async () => {
  const { db } = await import('../db')
  await db.end()
})

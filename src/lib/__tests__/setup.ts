import { afterEach, afterAll, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'

// Create a separate admin pool to bootstrap the test database
const adminPool = new Pool({
  connectionString: 'postgres://cthru:cthru@localhost:5433/postgres',
})

let testPool: Pool

beforeAll(async () => {
  // Create cthru_test database if it doesn't exist
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

  // Run migrations against cthru_test
  testPool = new Pool({
    connectionString: 'postgres://cthru:cthru@localhost:5433/cthru_test',
  })
  const migration = readFileSync(
    join(process.cwd(), 'migrations/001_events.sql'),
    'utf-8'
  )
  await testPool.query(migration)
  await testPool.end()
})

afterEach(async () => {
  // Import db lazily so it picks up the DATABASE_URL set by vitest
  const { db } = await import('../db')
  await db.query('TRUNCATE TABLE events RESTART IDENTITY')
})

afterAll(async () => {
  const { db } = await import('../db')
  await db.end()
})

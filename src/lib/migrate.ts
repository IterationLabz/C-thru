import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { db } from './db'

export async function runMigrations(): Promise<void> {
  const dir = join(process.cwd(), 'migrations')
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf-8')
    await db.query(sql)
  }
}

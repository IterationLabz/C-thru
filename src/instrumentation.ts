export async function register() {
  // Only run in the Node.js runtime, not in Edge
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('./lib/migrate')
    await runMigrations()
  }
}

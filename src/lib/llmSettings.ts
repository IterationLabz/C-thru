import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyKey } from './llm'

export function getLlmKeyHint(): string | null {
  const key = process.env.CTHRU_LLM_KEY
  if (!key) return null
  if (key.length <= 8) return key.slice(0, 4) + '••••'
  return key.slice(0, 7) + '••••' + key.slice(-4)
}

export function getLlmProviderConfig(): { provider: string; model: string } {
  return {
    provider: process.env.CTHRU_LLM_PROVIDER || 'anthropic',
    model: process.env.CTHRU_LLM_MODEL || 'claude-haiku-4-5-20251001',
  }
}

export async function verifyLlmKey(): Promise<{ ok: boolean; error?: string }> {
  try {
    await verifyKey()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function saveLlmConfig(key: string, provider: string, model: string): Promise<void> {
  const envPath = join(process.cwd(), '.env.local')
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

  content = setEnvLine(content, 'CTHRU_LLM_KEY', key)
  content = setEnvLine(content, 'CTHRU_LLM_PROVIDER', provider)
  content = setEnvLine(content, 'CTHRU_LLM_MODEL', model)

  writeFileSync(envPath, content, 'utf-8')
  // Note: changes take effect on next server restart
}

function setEnvLine(content: string, name: string, value: string): string {
  const line = `${name}=${value}`
  const regex = new RegExp(`^${name}=.*$`, 'm')
  return regex.test(content)
    ? content.replace(regex, line)
    : content.trimEnd() + '\n' + line + '\n'
}

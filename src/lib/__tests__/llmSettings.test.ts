import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../llm', () => ({ verifyKey: vi.fn() }))

import { verifyKey } from '../llm'
const mockVerifyKey = vi.mocked(verifyKey)

beforeEach(() => {
  mockVerifyKey.mockReset()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getLlmKeyHint', () => {
  it('returns null when CTHRU_LLM_KEY is not set', async () => {
    vi.stubEnv('CTHRU_LLM_KEY', '')
    const { getLlmKeyHint } = await import('../llmSettings')
    expect(getLlmKeyHint()).toBeNull()
  })

  it('returns a masked hint when key is set', async () => {
    vi.stubEnv('CTHRU_LLM_KEY', 'sk-ant-api03-longkeyvalue1234')
    const { getLlmKeyHint } = await import('../llmSettings')
    const hint = getLlmKeyHint()
    expect(hint).not.toBeNull()
    expect(hint).toContain('••••')
    // Shows first 7 chars and last 4
    expect(hint).toMatch(/^sk-ant-/)
    expect(hint).toMatch(/1234$/)
    // Does not expose the full key
    expect(hint).not.toContain('longkeyvalue')
  })

  it('handles a short key safely', async () => {
    vi.stubEnv('CTHRU_LLM_KEY', 'abc')
    const { getLlmKeyHint } = await import('../llmSettings')
    const hint = getLlmKeyHint()
    expect(hint).not.toBeNull()
    expect(hint).toContain('••••')
  })
})

describe('getLlmProviderConfig', () => {
  it('returns defaults when env vars are not set', async () => {
    vi.stubEnv('CTHRU_LLM_PROVIDER', '')
    vi.stubEnv('CTHRU_LLM_MODEL', '')
    const { getLlmProviderConfig } = await import('../llmSettings')
    const config = getLlmProviderConfig()
    expect(config.provider).toBe('anthropic')
    expect(config.model).toBe('claude-haiku-4-5-20251001')
  })

  it('returns the configured provider and model', async () => {
    vi.stubEnv('CTHRU_LLM_PROVIDER', 'openai')
    vi.stubEnv('CTHRU_LLM_MODEL', 'gpt-4o-mini')
    const { getLlmProviderConfig } = await import('../llmSettings')
    const config = getLlmProviderConfig()
    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o-mini')
  })
})

describe('verifyLlmKey', () => {
  it('returns ok:true when verifyKey succeeds', async () => {
    mockVerifyKey.mockResolvedValue(undefined)
    const { verifyLlmKey } = await import('../llmSettings')
    const result = await verifyLlmKey()
    expect(result).toEqual({ ok: true })
    expect(mockVerifyKey).toHaveBeenCalledOnce()
  })

  it('returns ok:false with error message when verifyKey throws', async () => {
    mockVerifyKey.mockRejectedValue(new Error('Invalid API key'))
    const { verifyLlmKey } = await import('../llmSettings')
    const result = await verifyLlmKey()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid API key')
  })

  it('returns ok:false when CTHRU_LLM_KEY is not configured', async () => {
    mockVerifyKey.mockRejectedValue(new Error('CTHRU_LLM_KEY is not configured'))
    const { verifyLlmKey } = await import('../llmSettings')
    const result = await verifyLlmKey()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('CTHRU_LLM_KEY')
  })
})

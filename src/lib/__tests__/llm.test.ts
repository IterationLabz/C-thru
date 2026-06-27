import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateText } from 'ai'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn(() => vi.fn(() => 'mock-model')) }))
vi.mock('@ai-sdk/openai',    () => ({ createOpenAI:    vi.fn(() => vi.fn(() => 'mock-model')) }))
vi.mock('@ai-sdk/groq',      () => ({ createGroq:      vi.fn(() => vi.fn(() => 'mock-model')) }))

const mockGenerateText = vi.mocked(generateText)

beforeEach(() => {
  mockGenerateText.mockReset()
  vi.stubEnv('CTHRU_LLM_KEY',      'test-key')
  vi.stubEnv('CTHRU_LLM_PROVIDER', 'anthropic')
  vi.stubEnv('CTHRU_LLM_MODEL',    'claude-haiku-4-5-20251001')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('lib/llm generateSql', () => {
  it('returns the SQL string from the LLM response', async () => {
    mockGenerateText.mockResolvedValue({ text: 'SELECT COUNT(*) FROM signups_v' } as any)

    const { generateSql } = await import('../llm')
    const sql = await generateSql('how many signups last week?', 'schema here')

    expect(sql).toBe('SELECT COUNT(*) FROM signups_v')
  })

  it('strips markdown code fences from the LLM response', async () => {
    mockGenerateText.mockResolvedValue({
      text: '```sql\nSELECT COUNT(*) FROM signups_v\n```',
    } as any)

    const { generateSql } = await import('../llm')
    const sql = await generateSql('how many signups?', 'schema here')

    expect(sql).toBe('SELECT COUNT(*) FROM signups_v')
  })

  it('throws if CTHRU_LLM_KEY is not configured', async () => {
    vi.stubEnv('CTHRU_LLM_KEY', '')

    const { generateSql } = await import('../llm')
    await expect(generateSql('question', 'schema')).rejects.toThrow('CTHRU_LLM_KEY')
  })

  it('throws for an unknown provider', async () => {
    vi.stubEnv('CTHRU_LLM_PROVIDER', 'unknown-llm')
    mockGenerateText.mockResolvedValue({ text: 'SELECT 1' } as any)

    const { generateSql } = await import('../llm')
    await expect(generateSql('question', 'schema')).rejects.toThrow('Unknown LLM provider')
  })

  it('passes question and schema context to the LLM', async () => {
    mockGenerateText.mockResolvedValue({ text: 'SELECT 1 FROM signups_v' } as any)

    const { generateSql } = await import('../llm')
    await generateSql('how many users?', 'signups_v: user_id, signed_up_at')

    const call = mockGenerateText.mock.calls[0][0]
    const prompt = JSON.stringify(call)
    expect(prompt).toContain('how many users?')
    expect(prompt).toContain('signups_v: user_id, signed_up_at')
  })
})

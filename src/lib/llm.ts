import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGroq } from '@ai-sdk/groq'

const SYSTEM_PROMPT = `You are a PostgreSQL expert for a product analytics system called C-thru.
Generate a single SQL SELECT query to answer the user's question.
Return ONLY the SQL query — no explanation, no markdown, no code fences, no commentary.
The query must reference only the views and columns provided in the schema context.`

export async function generateSql(question: string, schemaContext: string): Promise<string> {
  const key = process.env.CTHRU_LLM_KEY
  if (!key) throw new Error('CTHRU_LLM_KEY is not configured')

  const provider = process.env.CTHRU_LLM_PROVIDER ?? 'anthropic'
  const model = process.env.CTHRU_LLM_MODEL ?? 'claude-haiku-4-5-20251001'

  const resolvedModel = resolveModel(provider, model, key)

  const { text } = await generateText({
    model: resolvedModel,
    system: SYSTEM_PROMPT,
    prompt: `Schema:\n${schemaContext}\n\nQuestion: ${question}`,
  })

  return extractSql(text)
}

function resolveModel(provider: string, model: string, key: string) {
  switch (provider) {
    case 'openai':    return createOpenAI({ apiKey: key })(model)
    case 'anthropic': return createAnthropic({ apiKey: key })(model)
    case 'groq':      return createGroq({ apiKey: key })(model)
    default:          throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

function extractSql(raw: string): string {
  // Strip markdown code fences: ```sql ... ``` or ``` ... ```
  const fenced = raw.match(/```(?:sql)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  return raw.trim()
}

'use server'

import { revalidatePath } from 'next/cache'
import { pinQuery, unpinQuery } from '@/lib/pinnedQueries'

export async function pinQueryAction(question: string, sql: string): Promise<void> {
  await pinQuery(question, sql)
  revalidatePath('/')
}

export async function unpinQueryAction(id: number): Promise<void> {
  await unpinQuery(id)
  revalidatePath('/')
}

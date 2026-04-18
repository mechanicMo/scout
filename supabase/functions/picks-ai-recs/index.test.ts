import { assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'

Deno.test('picks-ai-recs rejects unauthenticated with 401', async () => {
  const req = new Request('https://example.com', { method: 'POST' })
  const res = await handler(req)
  if (res.status === 401) {
    const body = await res.clone().json()
    if (body.error) {
      return
    }
  }
  throw new Error(`Expected 401 with error message, got ${res.status}`)
})

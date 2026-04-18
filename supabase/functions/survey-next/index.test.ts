import { assertEquals } from 'std/assert/mod.ts'
import { handler } from './index.ts'

Deno.test('survey-next rejects unauthenticated request with 401', async () => {
  const req = new Request('https://example.com', { method: 'GET' })
  const res = await handler(req)
  assertEquals(res.status, 401)
})

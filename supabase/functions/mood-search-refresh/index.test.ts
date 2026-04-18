import { assertRejects, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'

Deno.test('mood-search-refresh rejects unauthenticated requests with 401', async () => {
  const req = new Request('https://example.com', {
    method: 'POST',
    body: JSON.stringify({ searchId: 'test-id' }),
  })
  const resp = await handler(req)
  assertEquals(resp.status, 401)
  const body = await resp.json()
  assertEquals(body.error, 'Unauthorized')
})

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'

Deno.test('tmdb-get-media rejects unauthenticated requests', async () => {
  const req = new Request('https://example.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tmdbId: 550, mediaType: 'movie' }),
  })
  const res = await handler(req)
  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(body.error, 'Unauthorized')
})

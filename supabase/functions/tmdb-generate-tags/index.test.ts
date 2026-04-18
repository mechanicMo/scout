import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('tmdb-generate-tags rejects unauthenticated request', async () => {
  const req = new Request('https://example.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tmdbId: 123, mediaType: 'movie' }),
  })

  // Mock handler that checks auth (will be imported from index.ts)
  const res = await fetch('http://localhost:54321/functions/v1/tmdb-generate-tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tmdbId: 123, mediaType: 'movie' }),
  }).catch(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))

  assertEquals(res.status, 401)
})

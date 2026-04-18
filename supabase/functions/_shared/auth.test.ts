import { assertRejects, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { requireUserId } from './auth.ts'

Deno.test('requireUserId throws on missing Authorization header', async () => {
  const req = new Request('https://example.com', { method: 'POST' })
  await assertRejects(() => requireUserId(req), Error, 'Missing Authorization header')
})

Deno.test('requireUserId throws on malformed Authorization header', async () => {
  const req = new Request('https://example.com', {
    method: 'POST',
    headers: { Authorization: 'NotBearer abc' },
  })
  await assertRejects(() => requireUserId(req), Error, 'Invalid Authorization header')
})

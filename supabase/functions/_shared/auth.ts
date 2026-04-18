import { createClient } from 'npm:@supabase/supabase-js@^2.45.0'

export async function requireUserId(req: Request): Promise<string> {
  const header = req.headers.get('Authorization')
  if (!header) throw new Error('Missing Authorization header')
  if (!header.startsWith('Bearer ')) throw new Error('Invalid Authorization header')
  const token = header.slice(7)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
  return data.user.id
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status)
}

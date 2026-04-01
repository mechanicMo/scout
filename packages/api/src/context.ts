import type { Context as HonoContext } from 'hono'

export interface TRPCContext {
  userId: string | null
}

export async function createContext(c: HonoContext): Promise<TRPCContext> {
  // Auth header: "Bearer <supabase-jwt>"
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return { userId: null }

  // In Plan 2, we'll verify the JWT with Supabase. For now, trust the payload.
  // DO NOT use this in production — proper JWT verification comes in Plan 2.
  try {
    const token = authHeader.slice(7)
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { userId: payload.sub ?? null }
  } catch {
    return { userId: null }
  }
}

import type { Context as HonoContext } from 'hono'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TRPCContext {
  userId: string | null
  [key: string]: unknown
}

export async function createContext(c: HonoContext): Promise<TRPCContext> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return { userId: null }

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { userId: null }

  return { userId: user.id }
}

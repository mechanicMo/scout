import type { Context as HonoContext } from 'hono'
import { createClient } from '@supabase/supabase-js'

let supabaseAdmin: ReturnType<typeof createClient> | undefined

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('SUPABASE_URL is required')
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    supabaseAdmin = createClient(url, key)
  }
  return supabaseAdmin
}

export interface TRPCContext {
  userId: string | null
  [key: string]: unknown
}

export async function createContext(c: HonoContext): Promise<TRPCContext> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return { userId: null }

  const token = authHeader.slice(7)
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return { userId: null }

  return { userId: user.id }
}

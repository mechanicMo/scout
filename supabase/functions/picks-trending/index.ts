// supabase/functions/picks-trending/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { fetchTrending, getTMDBToken } from '../_shared/tmdb.ts'

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)
  try {
    const userId = await requireUserId(req)
    const supabase = serviceClient()

    const [items, dismissed, watched] = await Promise.all([
      fetchTrending(getTMDBToken()),
      supabase.from('watchlist')
        .select('tmdb_id, media_type, status, resurface_after')
        .eq('user_id', userId),
      supabase.from('watch_history')
        .select('tmdb_id, media_type')
        .eq('user_id', userId),
    ])

    const today = new Date().toISOString().slice(0, 10)
    const dSet = new Set(
      (dismissed.data ?? []).filter((d: any) =>
        d.status === 'dismissed_never' ||
        (d.status === 'dismissed_not_now' && d.resurface_after && d.resurface_after > today)
      ).map((d: any) => `${d.tmdb_id}-${d.media_type}`)
    )
    const wSet = new Set(
      (watched.data ?? []).map((w: any) => `${w.tmdb_id}-${w.media_type}`)
    )

    const filtered = items.filter(i => {
      const key = `${i.tmdbId}-${i.mediaType}`
      return !dSet.has(key) && !wSet.has(key)
    })

    return jsonResponse({ items: filtered })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg.includes('Authorization') || msg === 'Unauthorized' ? 401 : 500
    return errorResponse(msg, status)
  }
}

serve(handler)

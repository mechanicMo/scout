import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { getTMDBToken } from '../_shared/tmdb.ts'

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)
  try {
    await requireUserId(req)
    const { query } = await req.json()
    if (typeof query !== 'string' || query.trim() === '') return errorResponse('query required', 400)
    const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=en-US`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getTMDBToken()}` } })
    if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`)
    const data = await res.json()
    const results = (data.results ?? [])
      .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r: any) => ({
        tmdbId: r.id,
        mediaType: r.media_type,
        title: r.title ?? r.name ?? '',
        posterPath: r.poster_path,
        year: (r.release_date || r.first_air_date) ? Number((r.release_date || r.first_air_date).slice(0, 4)) : null,
        overview: r.overview ?? '',
        genres: [],
        runtime: null,
        popularity: r.popularity ?? 0,
      }))
      .sort((a: any, b: any) => b.popularity - a.popularity)
    return jsonResponse(results)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg.includes('Authorization') ? 401 : 500
    return errorResponse(msg, status)
  }
}

serve(handler)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { getTMDBDetails, getTMDBToken, TMDB_GENRE_MAP } from '../_shared/tmdb.ts'
import { generateTags } from '../_shared/groq.ts'

interface Request_Body {
  tmdbId: number
  mediaType: 'movie' | 'tv'
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    // Require authentication
    await requireUserId(req)
  } catch {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const body: Request_Body = await req.json()
    const { tmdbId, mediaType } = body

    if (!tmdbId || !mediaType || !['movie', 'tv'].includes(mediaType)) {
      return errorResponse('Invalid request: tmdbId and mediaType (movie|tv) required')
    }

    const client = serviceClient()

    // Check media_cache for title and overview
    const { data: cached } = await client
      .from('media_cache')
      .select('title, overview, genres')
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .single()

    let title: string
    let overview: string
    let genres: string[]

    if (cached) {
      title = cached.title
      overview = cached.overview
      genres = cached.genres ?? []
    } else {
      // Fetch from TMDB
      const token = getTMDBToken()
      const details = await getTMDBDetails(token, tmdbId, mediaType)

      title = mediaType === 'movie' ? details.title : details.name
      overview = details.overview ?? ''
      genres = (details.genre_ids ?? [])
        .map((id: number) => TMDB_GENRE_MAP[id])
        .filter(Boolean)

      // Cache it (service role can write)
      await client
        .from('media_cache')
        .upsert({
          tmdb_id: tmdbId,
          media_type: mediaType,
          title,
          overview,
          genres,
        })
        .throwOnError()
    }

    // Generate tags via Groq
    const tags = await generateTags(tmdbId, title, overview, genres)

    return jsonResponse({ tags }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('tmdb-generate-tags error:', message)
    return errorResponse(message, 500)
  }
}

serve(handler)

import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { checkDailyLimit, logUsage, TooManyRequestsError } from '../_shared/rate-limit.ts'
import { summarizeMoodQuery, rankTitlesByMood } from '../_shared/groq.ts'
import { discoverTMDB, getTMDBToken } from '../_shared/tmdb.ts'
import { serviceClient } from '../_shared/supabase.ts'

export async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405)
    }

    // Require authentication
    let userId: string
    try {
      userId = await requireUserId(req)
    } catch {
      return errorResponse('Unauthorized', 401)
    }

    // Parse body
    let body: { query?: string }
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON', 400)
    }

    const query = (body.query ?? '').trim()
    if (!query) {
      return errorResponse('Query cannot be empty', 400)
    }

    // Initialize clients
    const supabase = serviceClient()
    const tmdbToken = getTMDBToken()

    // Check rate limit: 3/day for all users
    try {
      await checkDailyLimit(supabase, userId, 'mood_search', 3)
    } catch (e) {
      if (e instanceof TooManyRequestsError) {
        return errorResponse(e.message, 429)
      }
      throw e
    }

    // Summarize query if longer than 40 chars
    let title = query
    if (query.length > 40) {
      title = await summarizeMoodQuery(query)
    }

    // Discover popular movies and TV (30 each = 60 total)
    const [movies, tvShows] = await Promise.all([
      discoverTMDB(tmdbToken, 'movie', {
        sort_by: 'popularity.desc',
        page: 1,
        per_page: 30,
      }),
      discoverTMDB(tmdbToken, 'tv', {
        sort_by: 'popularity.desc',
        page: 1,
        per_page: 30,
      }),
    ])

    // Build full media map (preserves mediaType and all display fields)
    const allMedia = [
      ...movies.map(m => ({ ...m, mediaType: 'movie' as const })),
      ...tvShows.map(m => ({ ...m, mediaType: 'tv' as const })),
    ]
    const mediaMap = new Map(allMedia.map(m => [m.tmdbId, m]))

    // Groq ranking only needs tmdbId, title, overview
    const rankingCandidates = allMedia.map(m => ({
      tmdbId: m.tmdbId,
      title: m.title,
      overview: m.overview,
    }))

    // Rank by mood
    const rankedIds = await rankTitlesByMood(query, rankingCandidates)

    // Save search record
    const { data: searchRecord, error: insertError } = await supabase
      .from('mood_searches')
      .insert({
        user_id: userId,
        query,
        title,
        result_tmdb_ids: rankedIds,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      throw new Error(`Failed to save search: ${insertError.message}`)
    }

    const searchId = searchRecord.id

    // Trim history to 10 most recent searches
    const { data: allSearches } = await supabase
      .from('mood_searches')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if ((allSearches ?? []).length > 10) {
      const toDelete = (allSearches ?? []).slice(10).map(s => s.id)
      await supabase.from('mood_searches').delete().in('id', toDelete)
    }

    // Cache all ranked media so history lookups work without re-fetching
    const cacheRows = rankedIds
      .map(id => mediaMap.get(id))
      .filter(Boolean)
      .map(m => ({
        tmdb_id: m!.tmdbId,
        media_type: m!.mediaType,
        title: m!.title,
        overview: m!.overview,
        poster_path: m!.posterPath,
        backdrop_path: m!.backdropPath,
        year: m!.year,
        genres: m!.genres,
        vote_average: m!.voteAverage,
        last_synced: new Date().toISOString(),
      }))
    if (cacheRows.length > 0) {
      await supabase.from('media_cache').upsert(cacheRows, { onConflict: 'tmdb_id,media_type' })
    }

    // Log usage
    await logUsage(supabase, userId, 'mood_search')

    return jsonResponse({
      id: searchId,
      title,
      results: rankedIds.map(id => {
        const m = mediaMap.get(id)
        return {
          tmdbId: id,
          mediaType: m?.mediaType ?? 'movie',
          title: m?.title ?? '',
          overview: m?.overview ?? '',
          posterPath: m?.posterPath ?? null,
          backdropPath: m?.backdropPath ?? null,
          year: m?.year ?? null,
          genres: m?.genres ?? [],
        }
      }),
      createdAt: searchRecord.created_at,
    })
  } catch (e) {
    console.error('mood-search error:', e)
    return errorResponse(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

Deno.serve(handler)

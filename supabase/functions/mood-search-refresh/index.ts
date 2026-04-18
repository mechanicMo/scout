import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { checkDailyLimit, logUsage, TooManyRequestsError } from '../_shared/rate-limit.ts'
import { rankTitlesByMood, extractMoodIntent, type MoodIntent } from '../_shared/groq.ts'
import { discoverTMDB, getTMDBToken, getGenreIds, type TMDBMedia } from '../_shared/tmdb.ts'
import { serviceClient } from '../_shared/supabase.ts'

export async function handler(req: Request): Promise<Response> {
  try {
    let userId: string
    try {
      userId = await requireUserId(req)
    } catch {
      return errorResponse('Unauthorized', 401)
    }

    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405)
    }

    let body: { searchId?: string }
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const { searchId } = body
    if (!searchId || typeof searchId !== 'string') {
      return errorResponse('searchId is required', 400)
    }

    const supabase = serviceClient()

    try {
      await checkDailyLimit(supabase, userId, 'mood_search', 3, 3)
    } catch (err) {
      if (err instanceof TooManyRequestsError) {
        return errorResponse(err.message, 429)
      }
      throw err
    }

    const { data: moodSearch, error: lookupError } = await supabase
      .from('mood_searches')
      .select('id, user_id, query, title')
      .eq('id', searchId)
      .eq('user_id', userId)
      .single()

    if (lookupError || !moodSearch) {
      return errorResponse('Search not found', 404)
    }

    const tmdbToken = getTMDBToken()

    // Re-extract intent from the stored query so refresh uses the same targeted parameters
    const intent = await extractMoodIntent(moodSearch.query)

    // Fetch a different page of targeted results for variety
    const randomPage = Math.floor(Math.random() * 3) + 2 // pages 2-4 to avoid repeating page 1
    const types: ('movie' | 'tv')[] = intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType]
    const perType = intent.mediaType === 'both' ? 30 : 60

    const hasYear = intent.yearMin !== null || intent.yearMax !== null
    const hasGenres = intent.genres.length > 0

    const fetched = await Promise.all(
      types.map(t => {
        const params: Record<string, string | number> = {
          sort_by: 'popularity.desc',
          page: randomPage,
          'vote_count.gte': 30,
          per_page: perType,
        }
        if (hasGenres) {
          const ids = getGenreIds(intent.genres, t)
          if (ids.length > 0) params['with_genres'] = ids.join('|')
        }
        if (hasYear && intent.yearMin !== null) {
          params[t === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${intent.yearMin}-01-01`
        }
        if (hasYear && intent.yearMax !== null) {
          params[t === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${intent.yearMax}-12-31`
        }
        return discoverTMDB(tmdbToken, t, params).then(items => items.map(m => ({ ...m, mediaType: t })))
      })
    )
    const candidates = fetched.flat()
    const mediaMap = new Map(candidates.map(m => [m.tmdbId, m]))

    const rankingInput = candidates.map(m => ({ tmdbId: m.tmdbId, title: m.title, overview: m.overview }))
    const rankedIds = await rankTitlesByMood(moodSearch.query, rankingInput, intent.keywords)

    const refreshedAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('mood_searches')
      .update({ result_tmdb_ids: rankedIds, updated_at: refreshedAt })
      .eq('id', searchId)

    if (updateError) throw new Error(`Failed to update search: ${updateError.message}`)

    // Cache refreshed candidates
    const cacheRows = candidates.map(m => ({
      tmdb_id: m.tmdbId,
      media_type: m.mediaType,
      title: m.title,
      overview: m.overview,
      poster_path: m.posterPath,
      backdrop_path: m.backdropPath,
      year: m.year,
      genres: m.genres,
      vote_average: m.voteAverage,
      last_synced: refreshedAt,
    }))
    if (cacheRows.length > 0) {
      await supabase.from('media_cache').upsert(cacheRows, { onConflict: 'tmdb_id,media_type' })
    }

    await logUsage(supabase, userId, 'mood_search')

    return jsonResponse({
      id: searchId,
      title: moodSearch.title,
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
      refreshedAt,
    })
  } catch (err) {
    if (err instanceof TooManyRequestsError) {
      return errorResponse(err.message, 429)
    }
    console.error('mood-search-refresh error:', err)
    return errorResponse('Internal server error', 500)
  }
}

export default handler

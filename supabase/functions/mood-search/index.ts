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

    const candidates = [...movies, ...tvShows].map(m => ({
      tmdbId: m.tmdbId,
      title: m.title,
      overview: m.overview,
    }))

    // Rank by mood
    const rankedIds = await rankTitlesByMood(query, candidates)

    // Save search record
    const { data: searchRecord, error: insertError } = await supabase
      .from('mood_searches')
      .insert({
        user_id: userId,
        title,
        result_tmdb_ids: rankedIds,
      })
      .select('id')
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

    // Log usage
    await logUsage(supabase, userId, 'mood_search')

    return jsonResponse({
      searchId,
      title,
      results: rankedIds.map(id => ({
        tmdbId: id,
        mediaType: candidates.find(c => c.tmdbId === id) ? 'movie' : 'tv',
      })),
    })
  } catch (e) {
    console.error('mood-search error:', e)
    return errorResponse(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

Deno.serve(handler)

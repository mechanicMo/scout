import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { checkDailyLimit, logUsage, TooManyRequestsError } from '../_shared/rate-limit.ts'
import { discoverTMDB, getTMDBToken } from '../_shared/tmdb.ts'
import { rankTitlesByMood } from '../_shared/groq.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@^2.45.0'

function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url) throw new Error('SUPABASE_URL is required')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'scout' },
  }) as SupabaseClient
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Require authentication
    let userId: string
    try {
      userId = await requireUserId(req)
    } catch (err) {
      return errorResponse('Unauthorized', 401)
    }

    // Parse request body
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

    // Check rate limit: 3/day for all users
    await checkDailyLimit(supabase, userId, 'mood_search', 3, 3)

    // Look up existing mood_search record by searchId and userId
    const { data: moodSearch, error: lookupError } = await supabase
      .from('mood_searches')
      .select('id, user_id, query, title, result_tmdb_ids')
      .eq('id', searchId)
      .eq('user_id', userId)
      .single()

    if (lookupError || !moodSearch) {
      return errorResponse('Search not found', 404)
    }

    // Discover movies and TV from random page (1-5) for variety
    const randomPage = Math.floor(Math.random() * 5) + 1
    const [movies, tvShows] = await Promise.all([
      discoverTMDB(getTMDBToken(), 'movie', { page: randomPage }),
      discoverTMDB(getTMDBToken(), 'tv', { page: randomPage }),
    ])

    const candidates = [...movies, ...tvShows].map((m) => ({
      tmdbId: m.tmdbId,
      title: m.title,
      overview: m.overview,
    }))

    // Rank via rankTitlesByMood() using original query
    const rankedIds = await rankTitlesByMood(moodSearch.query, candidates)

    // Update mood_search record with new result_tmdb_ids and updated_at
    const { error: updateError } = await supabase
      .from('mood_searches')
      .update({
        result_tmdb_ids: rankedIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', searchId)

    if (updateError) {
      throw new Error(`Failed to update search: ${updateError.message}`)
    }

    // Log usage
    await logUsage(supabase, userId, 'mood_search')

    // Return { searchId, results }
    return jsonResponse({
      searchId,
      results: rankedIds,
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

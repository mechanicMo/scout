import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2.45.0'
import { errorResponse, jsonResponse, requireUserId } from '../_shared/auth.ts'
import { checkDailyLimit, logUsage } from '../_shared/rate-limit.ts'
import { generateRecommendations, type Recommendation, type TasteProfile, type WatchedItem } from '../_shared/groq.ts'
import { getTMDBDetails, getTMDBToken, normalizeTMDB, type TMDBMedia } from '../_shared/tmdb.ts'
import { createClient } from 'npm:@supabase/supabase-js@^2.45.0'

function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url) throw new Error('SUPABASE_URL is required')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'scout' },
  }) as any
}

const REC_CACHE_TTL_HOURS = 2

export async function handler(req: Request): Promise<Response> {
  try {
    const userId = await requireUserId(req)
    const supabase = serviceClient()

    // Build the full exclusion set (watch history + saved watchlist items)
    const { historyKeys, savedKeys } = await watchedSetFor(supabase, userId)
    const allExcludedKeys = new Set([...historyKeys, ...savedKeys])

    // Serve from cache when enough fresh recs remain after exclusion (cache hits are free)
    const cachedRecs = await getCachedRecs(supabase, userId)
    if (cachedRecs.length > 0) {
      const filtered = cachedRecs.filter((r: any) => !allExcludedKeys.has(makeWatchedKey(r.tmdb_id, r.media_type)))
      if (filtered.length >= 5) {
        const enriched = await enrichRecs(supabase, filtered.map((r: any) => ({ tmdbId: r.tmdb_id, mediaType: r.media_type })))
        return jsonResponse({ recommendations: enriched, rateLimited: false })
      }
    }

    // Cache is depleted or thin — need fresh generation. Check rate limit now.
    try {
      await checkDailyLimit(supabase, userId, 'ai_recs', 1)
    } catch {
      // Rate limited: return whatever cached recs survive exclusion (may be empty)
      const filtered = cachedRecs.filter((r: any) => !allExcludedKeys.has(makeWatchedKey(r.tmdb_id, r.media_type)))
      const enriched = filtered.length > 0
        ? await enrichRecs(supabase, filtered.map((r: any) => ({ tmdbId: r.tmdb_id, mediaType: r.media_type })))
        : []
      return jsonResponse({ recommendations: enriched, rateLimited: true })
    }

    // Fetch taste profile — new users may not have one yet
    const profile = await getTasteProfile(supabase, userId)
    if (!profile) {
      return jsonResponse({ recommendations: [], rateLimited: false })
    }

    // Fetch recent watch history (last 20)
    const history = await getWatchHistory(supabase, userId, 20)

    // Generate recommendations via Groq, passing saved items so it avoids them
    const newRecs = await generateRecommendations(profile, history, savedKeys)

    // Delete old pending recs and insert new ones
    await deleteOldPendingRecs(supabase, userId)
    if (newRecs.length > 0) {
      await insertPendingRecs(supabase, userId, newRecs)
    }

    await logUsage(supabase, userId, 'ai_recs')

    const enriched = await enrichRecs(supabase, newRecs)
    return jsonResponse({ recommendations: enriched, rateLimited: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message.includes('Missing Authorization') || message.includes('Invalid Authorization') || message.includes('Unauthorized')) {
      return errorResponse(message, 401)
    }
    console.error('picks-ai-recs error:', err)
    return errorResponse(message, 500)
  }
}

async function getCachedRecs(supabase: SupabaseClient, userId: string) {
  const cutoff = new Date(Date.now() - REC_CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const { data } = await (supabase as any)
    .from('recommendations')
    .select('tmdb_id, media_type')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('generated_at', cutoff)
    .order('generated_at', { ascending: false })
  return data ?? []
}

async function watchedSetFor(supabase: SupabaseClient, userId: string): Promise<{ historyKeys: Set<string>; savedKeys: Set<string> }> {
  const [{ data: historyData }, { data: savedData }] = await Promise.all([
    (supabase as any).from('watch_history').select('tmdb_id, media_type').eq('user_id', userId),
    (supabase as any).from('watchlist').select('tmdb_id, media_type').eq('user_id', userId).eq('status', 'saved'),
  ])
  const historyKeys = new Set<string>()
  historyData?.forEach((item: any) => historyKeys.add(makeWatchedKey(item.tmdb_id, item.media_type)))
  const savedKeys = new Set<string>()
  savedData?.forEach((item: any) => savedKeys.add(makeWatchedKey(item.tmdb_id, item.media_type)))
  return { historyKeys, savedKeys }
}

function makeWatchedKey(tmdbId: number, mediaType: string): string {
  return `${tmdbId}-${mediaType}`
}

async function getTasteProfile(supabase: SupabaseClient, userId: string): Promise<TasteProfile | null> {
  const { data } = await (supabase as any)
    .from('taste_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (!data) return null
  return {
    likedGenres: data.liked_genres ?? [],
    dislikedGenres: data.disliked_genres ?? [],
    likedThemes: data.liked_themes ?? [],
    favoriteActors: data.favorite_actors ?? [],
    services: data.services ?? [],
    notes: data.notes ?? '',
  }
}

async function getWatchHistory(supabase: SupabaseClient, userId: string, limit: number): Promise<WatchedItem[]> {
  const { data } = await (supabase as any)
    .from('watch_history')
    .select('tmdb_id, media_type, overall_score, tags')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false })
    .limit(limit)
  return data?.map((item: any) => ({
    tmdbId: item.tmdb_id,
    mediaType: item.media_type as 'movie' | 'tv',
    overallScore: item.overall_score,
    tags: item.tags ?? [],
  })) ?? []
}

async function deleteOldPendingRecs(supabase: SupabaseClient, userId: string): Promise<void> {
  await (supabase as any)
    .from('recommendations')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'pending')
}

async function insertPendingRecs(
  supabase: SupabaseClient,
  userId: string,
  recs: Recommendation[],
): Promise<void> {
  if (recs.length === 0) return
  const rows = recs.map((rec) => ({
    user_id: userId,
    tmdb_id: rec.tmdbId,
    media_type: rec.mediaType,
    status: 'pending',
  }))
  await (supabase as any).from('recommendations').insert(rows)
}

async function enrichRecs(supabase: SupabaseClient, recs: Recommendation[]): Promise<TMDBMedia[]> {
  const token = getTMDBToken()
  const enriched: TMDBMedia[] = []

  for (const rec of recs) {
    try {
      // Check cache first
      const { data: cached } = await (supabase as any)
        .from('media_cache')
        .select('*')
        .eq('tmdb_id', rec.tmdbId)
        .eq('media_type', rec.mediaType)
        .single()

      if (cached) {
        enriched.push(normalizeTMDB({
          id: cached.tmdb_id,
          media_type: cached.media_type,
          title: cached.title,
          name: cached.title,
          poster_path: cached.poster_path,
          backdrop_path: cached.backdrop_path,
          release_date: cached.year ? `${cached.year}-01-01` : null,
          first_air_date: cached.year ? `${cached.year}-01-01` : null,
          genre_ids: [],
          genres: cached.genres.map((g: string) => ({ name: g })),
          overview: cached.overview,
          runtime: cached.runtime,
          episode_run_time: cached.runtime ? [cached.runtime] : [],
          vote_average: cached.vote_average,
        }))
      } else {
        // Fetch from TMDB
        const details = await getTMDBDetails(token, rec.tmdbId, rec.mediaType)
        const normalized = normalizeTMDB({ ...details, media_type: rec.mediaType })
        enriched.push(normalized)

        // Cache it
        await (supabase as any).from('media_cache').insert({
          tmdb_id: rec.tmdbId,
          media_type: rec.mediaType,
          title: normalized.title,
          poster_path: normalized.posterPath,
          backdrop_path: normalized.backdropPath,
          year: normalized.year,
          genres: normalized.genres,
          overview: normalized.overview,
          runtime: normalized.runtime,
          vote_average: normalized.voteAverage,
          watch_providers: details.watch_providers ?? {},
          last_synced: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error(`Failed to enrich ${rec.tmdbId}:`, err)
      // Continue with next rec
    }
  }

  return enriched
}

Deno.serve(handler)

import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { checkDailyLimit, logUsage, TooManyRequestsError } from '../_shared/rate-limit.ts'
import { summarizeMoodQuery, rankTitlesByMood, extractMoodIntent, type MoodIntent } from '../_shared/groq.ts'
import { discoverTMDB, getTMDBToken, getGenreIds, type TMDBMedia } from '../_shared/tmdb.ts'
import { serviceClient } from '../_shared/supabase.ts'

const MIN_RESULTS = 8

export async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405)
    }

    let userId: string
    try {
      userId = await requireUserId(req)
    } catch {
      return errorResponse('Unauthorized', 401)
    }

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

    const supabase = serviceClient()
    const tmdbToken = getTMDBToken()

    try {
      await checkDailyLimit(supabase, userId, 'mood_search', 3)
    } catch (e) {
      if (e instanceof TooManyRequestsError) {
        return errorResponse(e.message, 429)
      }
      throw e
    }

    // Run intent extraction and title summarization in parallel
    const [intent, title] = await Promise.all([
      extractMoodIntent(query),
      query.length > 40 ? summarizeMoodQuery(query) : Promise.resolve(query),
    ])

    // Load user's excluded IDs: already watched + dismissed from watchlist
    const [historyRes, dismissedRes] = await Promise.all([
      supabase.from('watch_history').select('tmdb_id').eq('user_id', userId),
      supabase.from('watchlist')
        .select('tmdb_id')
        .eq('user_id', userId)
        .in('status', ['dismissed_not_now', 'dismissed_never']),
    ])
    const excludedIds = new Set<number>([
      ...(historyRes.data ?? []).map((r: any) => Number(r.tmdb_id)),
      ...(dismissedRes.data ?? []).map((r: any) => Number(r.tmdb_id)),
    ])

    // Fetch candidates with progressive fallback
    const { candidates, searchBroadened } = await fetchCandidates(tmdbToken, intent, excludedIds)

    // Groq ranking: always run for tone/vibe matching within the targeted pool
    const rankingInput = candidates.map(m => ({
      tmdbId: m.tmdbId,
      title: m.title,
      overview: m.overview,
    }))
    const rankedIds = await rankTitlesByMood(query, rankingInput, intent.keywords)

    const mediaMap = new Map(candidates.map(m => [m.tmdbId, m]))

    // Save search record
    const { data: searchRecord, error: insertError } = await supabase
      .from('mood_searches')
      .insert({ user_id: userId, query, title, result_tmdb_ids: rankedIds })
      .select('id, created_at')
      .single()

    if (insertError) throw new Error(`Failed to save search: ${insertError.message}`)

    // Trim history to 10 most recent
    const { data: allSearches } = await supabase
      .from('mood_searches')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if ((allSearches ?? []).length > 10) {
      const toDelete = (allSearches ?? []).slice(10).map((s: any) => s.id)
      await supabase.from('mood_searches').delete().in('id', toDelete)
    }

    // Cache all candidates so history lookups work
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
      last_synced: new Date().toISOString(),
    }))
    if (cacheRows.length > 0) {
      await supabase.from('media_cache').upsert(cacheRows, { onConflict: 'tmdb_id,media_type' })
    }

    await logUsage(supabase, userId, 'mood_search')

    return jsonResponse({
      id: searchRecord.id,
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
      ...(searchBroadened ? { searchBroadened } : {}),
    })
  } catch (e) {
    console.error('mood-search error:', e)
    return errorResponse(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

// ── Candidate fetching with progressive fallback ──────────────────────────────

type FetchResult = {
  candidates: TMDBMedia[]
  searchBroadened: { reason: string } | null
}

function buildDiscoverParams(
  intent: MoodIntent,
  mediaType: 'movie' | 'tv',
  applyGenres: boolean,
  applyYear: boolean,
  page = 1,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    sort_by: 'popularity.desc',
    page,
    'vote_count.gte': 30,
  }

  if (applyGenres && intent.genres.length > 0) {
    const ids = getGenreIds(intent.genres, mediaType)
    if (ids.length > 0) params['with_genres'] = ids.join('|')
  }

  if (applyYear) {
    if (intent.yearMin !== null) {
      params[mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] =
        `${intent.yearMin}-01-01`
    }
    if (intent.yearMax !== null) {
      params[mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] =
        `${intent.yearMax}-12-31`
    }
  }

  return params
}

async function fetchForIntent(
  tmdbToken: string,
  intent: MoodIntent,
  applyGenres: boolean,
  applyYear: boolean,
  page = 1,
): Promise<TMDBMedia[]> {
  const types: ('movie' | 'tv')[] = intent.mediaType === 'both'
    ? ['movie', 'tv']
    : [intent.mediaType]
  const perType = intent.mediaType === 'both' ? 30 : 60

  const results = await Promise.all(
    types.map(t =>
      discoverTMDB(tmdbToken, t, { ...buildDiscoverParams(intent, t, applyGenres, applyYear, page), per_page: perType })
        .then(items => items.map(m => ({ ...m, mediaType: t })))
    )
  )
  return results.flat()
}

async function fetchCandidates(
  tmdbToken: string,
  intent: MoodIntent,
  excludedIds: Set<number>,
): Promise<FetchResult> {
  const hasYear = intent.yearMin !== null || intent.yearMax !== null
  const hasGenres = intent.genres.length > 0

  // Level 0: full intent — genres + year range
  let all = await fetchForIntent(tmdbToken, intent, hasGenres, hasYear)
  let filtered = all.filter(m => !excludedIds.has(m.tmdbId))
  if (filtered.length >= MIN_RESULTS) {
    return { candidates: filtered, searchBroadened: null }
  }

  // Level 1: drop year range (keep genres)
  if (hasYear && hasGenres) {
    all = await fetchForIntent(tmdbToken, intent, true, false)
    filtered = all.filter(m => !excludedIds.has(m.tmdbId))
    if (filtered.length >= MIN_RESULTS) {
      const eraLabel = intent.yearMin && intent.yearMax
        ? `${intent.yearMin}–${intent.yearMax}`
        : intent.yearMin ? `${intent.yearMin} onwards`
        : `before ${intent.yearMax}`
      return {
        candidates: filtered,
        searchBroadened: { reason: `No exact matches for ${eraLabel} — showing similar titles from any year` },
      }
    }
  }

  // Level 2: drop genres (keep year if present)
  if (hasGenres) {
    all = await fetchForIntent(tmdbToken, intent, false, hasYear)
    filtered = all.filter(m => !excludedIds.has(m.tmdbId))
    if (filtered.length >= MIN_RESULTS) {
      return {
        candidates: filtered,
        searchBroadened: { reason: `Couldn't find exact genre matches — showing popular titles${hasYear ? ' from that era' : ''} instead` },
      }
    }
  }

  // Level 3: full fallback — no filters at all
  all = await fetchForIntent(tmdbToken, intent, false, false)
  filtered = all.filter(m => !excludedIds.has(m.tmdbId))
  return {
    candidates: filtered,
    searchBroadened: { reason: `Couldn't find close matches — showing popular titles instead` },
  }
}

Deno.serve(handler)

import { requireUserId, jsonResponse, errorResponse } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { getTMDBDetails, getTMDBToken, TMDB_GENRE_MAP } from '../_shared/tmdb.ts'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const PROVIDERS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface MediaCacheRow {
  tmdb_id: number
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  backdrop_path: string | null
  year: number | null
  genres: string[]
  tagline: string | null
  overview: string
  runtime: number | null
  vote_average: number | null
  director: string | null
  created_by: string[]
  cast: Array<{ name: string; character: string; profilePath: string | null }>
  content_rating: string | null
  number_of_seasons: number | null
  number_of_episodes: number | null
  status_text: string | null
  network: string | null
  watch_providers: Record<string, {
    flatrate?: Array<{ providerId: number; providerName: string; logoPath: string }>
    rent?: Array<{ providerId: number; providerName: string; logoPath: string }>
    buy?: Array<{ providerId: number; providerName: string; logoPath: string }>
  }>
  seasons_data: Array<{ season_number: number; episode_count: number }> | null
  last_synced: string
  watch_providers_synced: string | null
}

export interface MediaResponse {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
  genres: string[]
  tagline: string | null
  overview: string
  runtime: number | null
  voteAverage: number | null
  director: string | null
  createdBy: string[]
  cast: Array<{ name: string; character: string; profilePath: string | null }>
  contentRating: string | null
  numberOfSeasons: number | null
  numberOfEpisodes: number | null
  statusText: string | null
  network: string | null
  watchProviders: Record<string, {
    flatrate?: Array<{ providerId: number; providerName: string; logoPath: string }>
    rent?: Array<{ providerId: number; providerName: string; logoPath: string }>
    buy?: Array<{ providerId: number; providerName: string; logoPath: string }>
  }>
  seasons: Array<{ season_number: number; episode_count: number }> | null
  cached: boolean
  cachedAt: string | null
}

/**
 * Normalize TMDB details response into MediaResponse format.
 * Extracts cast, director, genres, ratings, and other relevant fields.
 */
function normalize(
  details: any,
  mediaType: 'movie' | 'tv',
): Omit<MediaResponse, 'cached' | 'cachedAt'> {
  // Extract cast (up to 15 cast members)
  const cast = (details.credits?.cast ?? [])
    .slice(0, 15)
    .map((member: any) => ({
      name: member.name,
      character: member.character,
      profilePath: member.profile_path ?? null,
    }))

  // Extract director (for movies) or creators (for TV)
  let director: string | null = null
  let createdBy: string[] = []

  if (mediaType === 'movie') {
    const directorCrew = (details.credits?.crew ?? []).find(
      (member: any) => member.job === 'Director',
    )
    director = directorCrew?.name ?? null
  } else {
    createdBy = (details.created_by ?? []).map((creator: any) => creator.name)
  }

  // Extract genres
  const genres = (details.genres ?? []).map((g: any) => g.name)

  // Extract content rating
  let contentRating: string | null = null
  if (mediaType === 'movie') {
    const releases = details.release_dates?.results ?? []
    const usRelease = releases.find((r: any) => r.iso_3166_1 === 'US')
    contentRating = usRelease?.release_dates?.[0]?.certification ?? null
  } else {
    const contentRatings = details.content_ratings?.results ?? []
    const usRating = contentRatings.find((r: any) => r.iso_3166_1 === 'US')
    contentRating = usRating?.rating ?? null
  }

  // Extract watch providers
  const providers = details['watch/providers']?.results ?? {}
  const watchProviders: MediaResponse['watchProviders'] = {}
  for (const [region, data] of Object.entries(providers)) {
    const d = data as any
    const mapProvider = (p: any) => ({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoPath: p.logo_path,
    })
    const regionEntry: MediaResponse['watchProviders'][string] = {}
    if (d?.flatrate?.length) regionEntry.flatrate = d.flatrate.map(mapProvider)
    if (d?.rent?.length) regionEntry.rent = d.rent.map(mapProvider)
    if (d?.buy?.length) regionEntry.buy = d.buy.map(mapProvider)
    if (Object.keys(regionEntry).length > 0) watchProviders[region] = regionEntry
  }

  const isMovie = mediaType === 'movie'
  const dateStr = isMovie ? details.release_date : details.first_air_date
  const year = dateStr ? Number(dateStr.slice(0, 4)) : null

  return {
    tmdbId: details.id,
    mediaType,
    title: (isMovie ? details.title : details.name) ?? '',
    posterPath: details.poster_path ?? null,
    backdropPath: details.backdrop_path ?? null,
    year,
    genres,
    tagline: details.tagline ?? null,
    overview: details.overview ?? '',
    runtime: details.runtime ?? (details.episode_run_time?.[0] ?? null),
    voteAverage: details.vote_average ?? null,
    director,
    createdBy,
    cast,
    contentRating,
    numberOfSeasons: details.number_of_seasons ?? null,
    numberOfEpisodes: details.number_of_episodes ?? null,
    statusText: details.status ?? null,
    network: details.networks?.[0]?.name ?? null,
    watchProviders,
    seasons: mediaType === 'tv'
      ? (details.seasons ?? [])
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => ({ season_number: s.season_number, episode_count: s.episode_count }))
      : null,
  }
}

/**
 * Transform a cached DB row into a MediaResponse.
 */
function mediaCacheToResponse(row: MediaCacheRow): MediaResponse {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    year: row.year,
    genres: row.genres,
    tagline: row.tagline,
    overview: row.overview,
    runtime: row.runtime,
    voteAverage: row.vote_average,
    director: row.director,
    createdBy: row.created_by,
    cast: row.cast,
    contentRating: row.content_rating,
    numberOfSeasons: row.number_of_seasons,
    numberOfEpisodes: row.number_of_episodes,
    statusText: row.status_text,
    network: row.network,
    watchProviders: row.watch_providers,
    seasons: row.seasons_data ?? null,
    cached: true,
    cachedAt: row.last_synced,
  }
}

/**
 * Check if cached media data is fresh (within TTL).
 * Watch providers have separate 7-day TTL.
 */
function isCacheFresh(
  lastSynced: string,
  watchProvidersSynced: string | null,
): { dataFresh: boolean; providersFresh: boolean } {
  const now = Date.now()
  const syncTime = new Date(lastSynced).getTime()
  const dataFresh = now - syncTime < CACHE_TTL_MS

  const providersTime = watchProvidersSynced ? new Date(watchProvidersSynced).getTime() : 0
  const providersFresh = providersTime > 0 && now - providersTime < PROVIDERS_TTL_MS

  return { dataFresh, providersFresh }
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Require authentication
    let userId: string
    try {
      userId = await requireUserId(req)
    } catch {
      return errorResponse('Unauthorized', 401)
    }

    // Parse request body
    const body = await req.json() as { tmdbId?: number; mediaType?: 'movie' | 'tv' }
    const { tmdbId, mediaType } = body

    if (!tmdbId || !mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      return errorResponse('tmdbId and mediaType are required', 400)
    }

    const db = serviceClient()

    // Check cache
    const { data: cached } = await db
      .from('media_cache')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .single()

    if (cached) {
      const { dataFresh, providersFresh } = isCacheFresh(
        cached.last_synced,
        cached.watch_providers_synced,
      )
      if (dataFresh) {
        // Data is fresh, return cached response
        return jsonResponse({
          ...mediaCacheToResponse(cached),
          cached: true,
        })
      }
    }

    // Fetch from TMDB
    const tmdbToken = getTMDBToken()
    const details = await getTMDBDetails(tmdbToken, tmdbId, mediaType)

    // Normalize response
    const normalized = normalize(details, mediaType)

    // Upsert into cache
    const now = new Date().toISOString()
    await db.from('media_cache').upsert(
      {
        tmdb_id: tmdbId,
        media_type: mediaType,
        title: normalized.title,
        poster_path: normalized.posterPath,
        backdrop_path: normalized.backdropPath,
        year: normalized.year,
        genres: normalized.genres,
        tagline: normalized.tagline,
        overview: normalized.overview,
        runtime: normalized.runtime,
        vote_average: normalized.voteAverage,
        director: normalized.director,
        created_by: normalized.createdBy,
        cast: normalized.cast,
        content_rating: normalized.contentRating,
        number_of_seasons: normalized.numberOfSeasons,
        number_of_episodes: normalized.numberOfEpisodes,
        status_text: normalized.statusText,
        network: normalized.network,
        watch_providers: normalized.watchProviders,
        seasons_data: normalized.seasons ?? null,
        last_synced: now,
        watch_providers_synced: normalized.watchProviders && Object.keys(normalized.watchProviders).length > 0 ? now : null,
      },
      { onConflict: 'tmdb_id,media_type' },
    )

    return jsonResponse({
      ...normalized,
      cached: false,
      cachedAt: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

// Serve the handler
Deno.serve(handler)

import type { MediaItem, MediaType, WatchProviders, CastMember } from './types'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'

interface TMDBProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

interface TMDBProviderRegion {
  flatrate?: TMDBProvider[]
  rent?: TMDBProvider[]
  buy?: TMDBProvider[]
  link?: string
}

function mapProvider(p: TMDBProvider) {
  return {
    providerId: p.provider_id,
    providerName: p.provider_name,
    logoPath: p.logo_path,
  }
}

export function buildPosterUrl(posterPath: string | null): string | null {
  if (!posterPath) return null
  return `${POSTER_BASE}${posterPath}`
}

export async function fetchMedia(
  tmdbId: number,
  mediaType: MediaType,
  readAccessToken: string
): Promise<MediaItem> {
  const endpoint = mediaType === 'movie' ? 'movie' : 'tv'
  const appendMovie = 'watch%2Fproviders,credits,release_dates'
  const appendTV = 'watch%2Fproviders,credits,content_ratings'
  const append = mediaType === 'movie' ? appendMovie : appendTV
  const url = `${TMDB_BASE}/${endpoint}/${tmdbId}?append_to_response=${append}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${readAccessToken}` },
  })
  if (!res.ok) throw new Error(`TMDB fetch failed: ${res.status}`)
  const data = await res.json()

  const title = mediaType === 'movie' ? data.title : data.name
  const dateField = mediaType === 'movie' ? data.release_date : data.first_air_date
  const year = dateField ? new Date(dateField).getFullYear() : null
  const genres: string[] = (data.genres ?? []).map((g: { name: string }) => g.name)
  const runtime = mediaType === 'movie'
    ? data.runtime ?? null
    : data.episode_run_time?.[0] ?? null

  // Cast — top 6
  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 6).map(
    (c: { name: string; character: string; profile_path: string | null }) => ({
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ?? null,
    })
  )

  // Director (movies) / Created by (TV)
  let director: string | null = null
  let createdBy: string[] = []
  if (mediaType === 'movie') {
    const directorEntry = (data.credits?.crew ?? []).find(
      (c: { job: string; name: string }) => c.job === 'Director'
    )
    director = directorEntry?.name ?? null
  } else {
    createdBy = (data.created_by ?? []).map((c: { name: string }) => c.name)
  }

  // Content rating
  let contentRating: string | null = null
  if (mediaType === 'movie') {
    const usRelease = (data.release_dates?.results ?? []).find(
      (r: { iso_3166_1: string }) => r.iso_3166_1 === 'US'
    )
    const ratingEntry = (usRelease?.release_dates ?? []).find(
      (r: { certification: string }) => r.certification
    )
    contentRating = ratingEntry?.certification ?? null
  } else {
    const usRating = (data.content_ratings?.results ?? []).find(
      (r: { iso_3166_1: string }) => r.iso_3166_1 === 'US'
    )
    contentRating = usRating?.rating ?? null
  }

  // Watch providers
  const rawProviders = data['watch/providers']?.results ?? {}
  const watchProviders: WatchProviders = {}
  for (const [region, val] of Object.entries(rawProviders as Record<string, TMDBProviderRegion>)) {
    const regionData: WatchProviders[string] = {}
    const flatrate = (val.flatrate ?? []).map(mapProvider)
    const rent = (val.rent ?? []).map(mapProvider)
    const buy = (val.buy ?? []).map(mapProvider)
    if (flatrate.length > 0) regionData.flatrate = flatrate
    if (rent.length > 0) regionData.rent = rent
    if (buy.length > 0) regionData.buy = buy
    watchProviders[region] = regionData
  }

  return {
    tmdbId,
    mediaType,
    title,
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    year,
    genres,
    tagline: data.tagline || null,
    overview: data.overview ?? '',
    runtime,
    voteAverage: data.vote_average ?? null,
    director,
    createdBy,
    cast,
    contentRating,
    numberOfSeasons: data.number_of_seasons ?? null,
    numberOfEpisodes: data.number_of_episodes ?? null,
    statusText: data.status ?? null,
    network: data.networks?.[0]?.name ?? null,
    watchProviders,
  }
}

export async function searchTMDB(
  query: string,
  readAccessToken: string
): Promise<MediaItem[]> {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&include_adult=false`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${readAccessToken}` },
  })
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`)
  const data = await res.json()

  const results: MediaItem[] = []
  for (const item of data.results ?? []) {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') continue
    const mediaType: MediaType = item.media_type
    const title = mediaType === 'movie' ? item.title : item.name
    const dateField = mediaType === 'movie' ? item.release_date : item.first_air_date
    results.push({
      tmdbId: item.id,
      mediaType,
      title,
      posterPath: item.poster_path ?? null,
      backdropPath: item.backdrop_path ?? null,
      year: dateField ? new Date(dateField).getFullYear() : null,
      genres: [],
      tagline: null,
      overview: item.overview ?? '',
      runtime: null,
      voteAverage: item.vote_average ?? null,
      director: null,
      createdBy: [],
      cast: [],
      contentRating: null,
      numberOfSeasons: null,
      numberOfEpisodes: null,
      statusText: null,
      network: null,
      watchProviders: {},
    })
  }
  return results
}

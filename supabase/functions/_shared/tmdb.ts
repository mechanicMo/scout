// supabase/functions/_shared/tmdb.ts
// Minimal TMDB fetch helpers. Ported from packages/shared/src/tmdb.ts for Deno.

const BASE = 'https://api.themoviedb.org/3'

export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
}

function tmdbHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

export type TMDBMedia = {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
  genres: string[]
  overview: string
  runtime: number | null
  voteAverage: number | null
}

export async function fetchTrending(token: string): Promise<TMDBMedia[]> {
  const url = `${BASE}/trending/all/week?language=en-US`
  const res = await fetch(url, { headers: tmdbHeaders(token) })
  if (!res.ok) throw new Error(`TMDB trending failed: ${res.status}`)
  const data = await res.json()
  return (data.results ?? [])
    .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
    .map(normalizeTMDB)
}

export async function discoverTMDB(
  token: string,
  mediaType: 'movie' | 'tv',
  params: Record<string, string | number>,
): Promise<TMDBMedia[]> {
  const qs = new URLSearchParams({
    language: 'en-US',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })
  const url = `${BASE}/discover/${mediaType}?${qs}`
  const res = await fetch(url, { headers: tmdbHeaders(token) })
  if (!res.ok) throw new Error(`TMDB discover failed: ${res.status}`)
  const data = await res.json()
  return (data.results ?? []).map((r: any) => normalizeTMDB({ ...r, media_type: mediaType }))
}

export async function getTMDBDetails(
  token: string, tmdbId: number, mediaType: 'movie' | 'tv',
): Promise<any> {
  const appends = mediaType === 'movie'
    ? 'credits,watch/providers,release_dates'
    : 'credits,watch/providers,content_ratings'
  const url = `${BASE}/${mediaType}/${tmdbId}?append_to_response=${appends}&language=en-US`
  const res = await fetch(url, { headers: tmdbHeaders(token) })
  if (!res.ok) throw new Error(`TMDB details failed: ${res.status}`)
  return await res.json()
}

export function normalizeTMDB(r: any): TMDBMedia {
  const isMovie = r.media_type === 'movie'
  const dateStr = isMovie ? r.release_date : r.first_air_date
  const year = dateStr ? Number(dateStr.slice(0, 4)) : null
  return {
    tmdbId: r.id,
    mediaType: r.media_type,
    title: (isMovie ? r.title : r.name) ?? '',
    posterPath: r.poster_path ?? null,
    backdropPath: r.backdrop_path ?? null,
    year,
    genres: (r.genre_ids ?? []).map((id: number) => TMDB_GENRE_MAP[id]).filter(Boolean),
    overview: r.overview ?? '',
    runtime: r.runtime ?? (r.episode_run_time?.[0] ?? null),
    voteAverage: r.vote_average ?? null,
  }
}

export function getTMDBToken(): string {
  const t = Deno.env.get('TMDB_READ_ACCESS_TOKEN')
  if (!t) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return t
}

// Genre name → TMDB ID, keyed by media type.
// Movies and TV use different IDs for overlapping concepts (e.g. Action vs Action & Adventure).
const MOVIE_GENRE_IDS: Record<string, number> = {
  'Action': 28, 'Adventure': 12, 'Animation': 16, 'Comedy': 35, 'Crime': 80,
  'Documentary': 99, 'Drama': 18, 'Family': 10751, 'Fantasy': 14, 'History': 36,
  'Horror': 27, 'Music': 10402, 'Mystery': 9648, 'Romance': 10749,
  'Science Fiction': 878, 'Sci-Fi': 878, 'Sci-Fi & Fantasy': 878,
  'Thriller': 53, 'War': 10752, 'Western': 37,
}

const TV_GENRE_IDS: Record<string, number> = {
  'Action': 10759, 'Action & Adventure': 10759, 'Adventure': 10759,
  'Animation': 16, 'Comedy': 35, 'Crime': 80, 'Documentary': 99, 'Drama': 18,
  'Family': 10751, 'Kids': 10762, 'Mystery': 9648, 'News': 10763,
  'Reality': 10764, 'Romance': 10749, 'Sci-Fi & Fantasy': 10765,
  'Science Fiction': 10765, 'Sci-Fi': 10765,
  'Thriller': 80, 'War': 10768, 'War & Politics': 10768, 'Western': 37,
}

/** Maps genre names (as Groq might return them) to TMDB genre IDs for a given media type. */
export function getGenreIds(genres: string[], mediaType: 'movie' | 'tv'): number[] {
  const map = mediaType === 'movie' ? MOVIE_GENRE_IDS : TV_GENRE_IDS
  return [...new Set(genres.map(g => map[g]).filter((id): id is number => id !== undefined))]
}

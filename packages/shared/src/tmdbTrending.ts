// packages/shared/src/tmdbTrending.ts
import type { MediaItem, MediaType } from './types'

const TMDB_BASE = 'https://api.themoviedb.org/3'

interface TMDBTrendingItem {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
}

export async function fetchTrending(readAccessToken: string): Promise<MediaItem[]> {
  const headers = { Authorization: `Bearer ${readAccessToken}` }

  const [moviesRes, tvRes] = await Promise.all([
    fetch(`${TMDB_BASE}/trending/movie/week`, { headers }),
    fetch(`${TMDB_BASE}/trending/tv/week`, { headers }),
  ])

  if (!moviesRes.ok) throw new Error(`TMDB trending/movie failed: ${moviesRes.status}`)
  if (!tvRes.ok) throw new Error(`TMDB trending/tv failed: ${tvRes.status}`)

  const [moviesData, tvData] = await Promise.all([moviesRes.json(), tvRes.json()])

  function mapItem(item: TMDBTrendingItem, mediaType: MediaType): MediaItem {
    const title = mediaType === 'movie' ? (item.title ?? '') : (item.name ?? '')
    const dateField = mediaType === 'movie' ? item.release_date : item.first_air_date
    const year = dateField ? new Date(dateField).getFullYear() : null
    return {
      tmdbId: item.id,
      mediaType,
      title,
      posterPath: item.poster_path ?? null,
      backdropPath: item.backdrop_path ?? null,
      year,
      genres: [],
      tagline: null,
      overview: item.overview ?? '',
      runtime: null,
      voteAverage: null,
      director: null,
      createdBy: [],
      cast: [],
      contentRating: null,
      numberOfSeasons: null,
      numberOfEpisodes: null,
      statusText: null,
      network: null,
      watchProviders: {},
    }
  }

  const movies: MediaItem[] = (moviesData.results ?? []).map((item: TMDBTrendingItem) => mapItem(item, 'movie'))
  const tv: MediaItem[] = (tvData.results ?? []).map((item: TMDBTrendingItem) => mapItem(item, 'tv'))

  // Interleave: movie, tv, movie, tv...
  const combined: MediaItem[] = []
  const maxLen = Math.max(movies.length, tv.length)
  for (let i = 0; i < maxLen; i++) {
    if (movies[i]) combined.push(movies[i])
    if (tv[i]) combined.push(tv[i])
  }
  return combined
}

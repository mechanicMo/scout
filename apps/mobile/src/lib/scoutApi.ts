import { supabase } from './supabase'
import type { MediaType } from '@scout/shared'

/**
 * Response types for Edge Function calls
 */

export interface PicksItem {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
  genres: string[]
  voteAverage: number | null
  overview: string
}

export interface PicksTrendingResponse {
  items: PicksItem[]
}

export interface Recommendation {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
  genres: string[]
  voteAverage: number | null
  overview: string
}

export interface PicksAiRecsResponse {
  recommendations: Recommendation[]
}

export interface SurveyQuestion {
  question: string
  options: string[]
  multiSelect?: boolean
}

export type SurveyNextResponse =
  | { id: string; question: string; options: string[]; multi_select: boolean }
  | { question: null }

export interface MediaDetails {
  tmdbId: number
  mediaType: MediaType
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
  cast: Array<{ name: string; character: string }>
  contentRating: string | null
  numberOfSeasons: number | null
  numberOfEpisodes: number | null
  statusText: string | null
  network: string | null
  watchProviders: Record<string, { provider: string; region: string }>
  cached: boolean
  cachedAt: string | null
}

export type TmdbGetMediaResponse = MediaDetails

export interface TmdbGenerateTagsResponse {
  tags: string[]
}

export interface MoodSearchResult {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
  genres: string[]
}

export interface MoodSearchResponse {
  id: string
  title: string
  results: MoodSearchResult[]
  createdAt: string
}

export interface MoodSearchRefreshResponse {
  id: string
  title: string
  results: MoodSearchResult[]
  refreshedAt: string
}

/**
 * Helper to invoke Edge Functions with proper error handling for React Query
 */
async function invokeEdgeFunction<T>(
  functionName: string,
  payload?: Record<string, any>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body: payload,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (error) {
    const errorMessage = typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Unknown error from Edge Function'

    const err = new Error(`${functionName}: ${errorMessage}`)
    Object.assign(err, { status: 500 })
    throw err
  }

  return data as T
}

/**
 * Fetch trending picks for the authenticated user.
 * Filters out items already dismissed, dismissed permanently, or already watched.
 */
export async function picksTrending(): Promise<PicksItem[]> {
  const response = await invokeEdgeFunction<PicksTrendingResponse>('picks-trending', {})
  return response.items
}

/**
 * Fetch AI recommendations for the authenticated user.
 * Rate-limited: free users 1/day, paid users unlimited.
 */
export async function picksAiRecs(): Promise<Recommendation[]> {
  const response = await invokeEdgeFunction<PicksAiRecsResponse>('picks-ai-recs', {})
  return response.recommendations
}

/**
 * Get the next survey question for taste profile setup.
 * Returns the next unanswered question, or generates a new AI question.
 */
export async function surveyNext(): Promise<SurveyNextResponse> {
  const response = await invokeEdgeFunction<SurveyNextResponse>('survey-next', {})
  return response
}

/**
 * Fetch detailed media information from TMDB.
 * Checks cache first (24h TTL), then queries TMDB if not cached.
 */
export async function tmdbGetMedia(
  tmdbId: number,
  mediaType: MediaType,
): Promise<MediaDetails> {
  return await invokeEdgeFunction<TmdbGetMediaResponse>(
    'tmdb-get-media',
    { tmdbId, mediaType },
  )
}

/**
 * Generate AI-powered tags for a media item based on its plot and genre.
 * Uses Groq LLM to analyze the content and suggest relevant tags.
 */
export async function tmdbGenerateTags(
  tmdbId: number,
  mediaType: MediaType,
): Promise<string[]> {
  const response = await invokeEdgeFunction<TmdbGenerateTagsResponse>(
    'tmdb-generate-tags',
    { tmdbId, mediaType },
  )
  return response.tags
}

/**
 * Search for media titles by keyword query.
 * Returns a list of movies and TV shows matching the query.
 */
export async function tmdbSearch(query: string): Promise<PicksItem[]> {
  const response = await invokeEdgeFunction<PicksItem[]>('tmdb-search', { query })
  return response
}

/**
 * Search for media using a mood-based query.
 * Summarizes long queries, discovers top movies/TV, and ranks by mood match.
 * Rate-limited to 3/day for all users.
 */
export async function moodSearch(query: string): Promise<MoodSearchResponse> {
  const response = await invokeEdgeFunction<MoodSearchResponse>('mood-search', {
    query,
  })
  return response
}

/**
 * Refresh/re-rank results for an existing mood search by ID.
 * Returns updated rankings for the same search query.
 */
export async function moodSearchRefresh(searchId: string): Promise<MoodSearchRefreshResponse> {
  const response = await invokeEdgeFunction<MoodSearchRefreshResponse>('mood-search-refresh', {
    searchId,
  })
  return response
}

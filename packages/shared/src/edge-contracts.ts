import { z } from 'zod'

/**
 * Edge Function Contract Schemas
 *
 * Zod validation schemas for all Edge Function inputs and outputs.
 * These schemas define the contract between the client and server.
 */

// ============================================================================
// Base Types
// ============================================================================

export const MediaTypeSchema = z.enum(['movie', 'tv'])
export type MediaType = z.infer<typeof MediaTypeSchema>

export const CastMemberSchema = z.object({
  name: z.string(),
  character: z.string(),
  profilePath: z.string().nullable(),
})
export type CastMember = z.infer<typeof CastMemberSchema>

export const WatchProviderSchema = z.object({
  providerId: z.number(),
  providerName: z.string(),
  logoPath: z.string(),
})
export type WatchProvider = z.infer<typeof WatchProviderSchema>

export const WatchProvidersSchema = z.record(
  z.string(),
  z.object({
    flatrate: z.array(WatchProviderSchema).optional(),
    rent: z.array(WatchProviderSchema).optional(),
    buy: z.array(WatchProviderSchema).optional(),
  })
)
export type WatchProviders = z.infer<typeof WatchProvidersSchema>

// ============================================================================
// Media Item Schemas
// ============================================================================

/**
 * Base media item schema with essential fields
 * Used by Picks/Trending endpoints
 */
export const MediaItemSchema = z.object({
  tmdbId: z.number(),
  mediaType: MediaTypeSchema,
  title: z.string(),
  posterPath: z.string().nullable(),
  year: z.number().nullable(),
  genres: z.array(z.string()),
  overview: z.string(),
  runtime: z.number().nullable(),
})
export type MediaItem = z.infer<typeof MediaItemSchema>

/**
 * Extended media item schema with all details
 * Used by media detail endpoints
 */
export const MediaDetailSchema = MediaItemSchema.extend({
  backdropPath: z.string().nullable(),
  tagline: z.string().nullable(),
  voteAverage: z.number().nullable(),
  director: z.string().nullable(),
  createdBy: z.array(z.string()),
  cast: z.array(CastMemberSchema),
  contentRating: z.string().nullable(),
  numberOfSeasons: z.number().nullable(),
  numberOfEpisodes: z.number().nullable(),
  statusText: z.string().nullable(),
  network: z.string().nullable(),
  watchProviders: WatchProvidersSchema,
})
export type MediaDetail = z.infer<typeof MediaDetailSchema>

// ============================================================================
// Picks/Trending Endpoints
// ============================================================================

/**
 * Output for /picks/trending endpoint
 * Returns an array of trending media items
 */
export const PicksTrendingOutputSchema = z.array(MediaItemSchema)
export type PicksTrendingOutput = z.infer<typeof PicksTrendingOutputSchema>

/**
 * Output for /picks/ai-recs endpoint
 * Returns an array of AI-generated recommendations
 */
export const PicksAiRecsOutputSchema = z.array(MediaItemSchema)
export type PicksAiRecsOutput = z.infer<typeof PicksAiRecsOutputSchema>

// ============================================================================
// TMDB Detail Endpoints
// ============================================================================

/**
 * Input for /tmdb/media/:tmdbId/:mediaType endpoint
 * Fetches detailed information about a specific media item
 */
export const TmdbGetMediaInputSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: MediaTypeSchema,
})
export type TmdbGetMediaInput = z.infer<typeof TmdbGetMediaInputSchema>

/**
 * Output for /tmdb/media/:tmdbId/:mediaType endpoint
 */
export const TmdbMediaDetailOutputSchema = MediaDetailSchema
export type TmdbMediaDetailOutput = z.infer<typeof TmdbMediaDetailOutputSchema>

// ============================================================================
// TMDB Tags Generation
// ============================================================================

/**
 * Input for /tmdb/generate-tags endpoint
 * Generates AI tags based on media details
 */
export const TmdbGenerateTagsInputSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: MediaTypeSchema,
})
export type TmdbGenerateTagsInput = z.infer<typeof TmdbGenerateTagsInputSchema>

/**
 * Output for /tmdb/generate-tags endpoint
 * Returns an array of AI-generated tags
 */
export const TmdbGenerateTagsOutputSchema = z.array(z.string())
export type TmdbGenerateTagsOutput = z.infer<typeof TmdbGenerateTagsOutputSchema>

// ============================================================================
// Survey Questions
// ============================================================================

/**
 * Schema for a survey question
 * Used in taste profile survey flow
 */
export const SurveyQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  multiSelect: z.boolean().optional().default(false),
  source: z.string().optional(),
})
export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>

/**
 * Output for /survey/next endpoint
 * Returns the next survey question or null if survey is complete
 */
export const SurveyNextOutputSchema = SurveyQuestionSchema.nullable()
export type SurveyNextOutput = z.infer<typeof SurveyNextOutputSchema>

// ============================================================================
// Mood Search
// ============================================================================

/**
 * Input for /mood-search endpoint
 * Initiates a mood-based media search
 */
export const MoodSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
})
export type MoodSearchInput = z.infer<typeof MoodSearchInputSchema>

/**
 * Output for /mood-search endpoint
 * Returns search results with a searchId for refreshing
 */
export const MoodSearchOutputSchema = z.object({
  searchId: z.string(),
  title: z.string(),
  results: z.array(MediaItemSchema),
})
export type MoodSearchOutput = z.infer<typeof MoodSearchOutputSchema>

/**
 * Input for /mood-search/refresh/:searchId endpoint
 * Refreshes results for a previous mood search
 */
export const MoodSearchRefreshInputSchema = z.object({
  searchId: z.string(),
})
export type MoodSearchRefreshInput = z.infer<typeof MoodSearchRefreshInputSchema>

/**
 * Output for /mood-search/refresh/:searchId endpoint
 * Returns refreshed search results
 */
export const MoodSearchRefreshOutputSchema = z.object({
  searchId: z.string(),
  results: z.array(MediaItemSchema),
})
export type MoodSearchRefreshOutput = z.infer<typeof MoodSearchRefreshOutputSchema>

// ============================================================================
// Error Response
// ============================================================================

/**
 * Standard error response schema for all endpoints
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

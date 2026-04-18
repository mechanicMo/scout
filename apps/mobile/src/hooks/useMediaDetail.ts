import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaType } from '@scout/shared'
import { tmdbGetMedia, tmdbGenerateTags, tmdbSearch } from '../lib/scoutApi'
import type { MediaDetails, TmdbGenerateTagsResponse, PicksItem } from '../lib/scoutApi'
import { queryKeys } from '../queries/keys'

/**
 * Query for fetching detailed media information from TMDB.
 * Checks cache first (24h TTL), then queries TMDB if not cached.
 */
export function useMediaDetail(tmdbId: number, mediaType: MediaType) {
  return useQuery({
    queryKey: queryKeys.mediaDetail.byId(tmdbId, mediaType),
    queryFn: async () => {
      const details = await tmdbGetMedia(tmdbId, mediaType)
      return details
    },
    enabled: !!tmdbId && !!mediaType, // Only run query if both params are present
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - TMDB data doesn't change often
  })
}

/**
 * Mutation to generate AI-powered tags for a media item with optimistic UI.
 * Uses Groq LLM to analyze the content and suggest relevant tags.
 */
export function useGenerateTags(tmdbId?: number, mediaType?: MediaType, enabled?: boolean) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tmdbId: id, mediaType: type }: { tmdbId: number; mediaType: MediaType }) => {
      const tags = await tmdbGenerateTags(id, type)
      return tags
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches for this media
      await queryClient.cancelQueries({
        queryKey: queryKeys.mediaDetail.byId(variables.tmdbId, variables.mediaType),
      })

      const previousData = queryClient.getQueryData(
        queryKeys.mediaDetail.byId(variables.tmdbId, variables.mediaType),
      )

      // Optimistically set tags to empty while generating
      queryClient.setQueryData(
        queryKeys.mediaDetail.byId(variables.tmdbId, variables.mediaType),
        (old: MediaDetails | undefined) => {
          if (!old) return old
          return { ...old, tags: [] }
        },
      )

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.mediaDetail.byId(variables.tmdbId, variables.mediaType),
          context.previousData,
        )
      }
    },
  })
}

/**
 * Search TMDB for media titles by keyword query.
 * Returns movies and TV shows matching the query.
 * Requires at least 2 characters to execute.
 */
export function useSearchTitles(query: string) {
  return useQuery({
    queryKey: ['scout', 'tmdb', 'search', query],
    queryFn: () => tmdbSearch(query),
    enabled: query.length >= 2,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { picksTrending, picksAiRecs } from '../lib/scoutApi'
import type { PicksItem, Recommendation } from '../lib/scoutApi'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

/**
 * Query for fetching trending picks for the authenticated user.
 * Filters out items already dismissed, dismissed permanently, or already watched.
 */
export function useTrendingPicks() {
  return useQuery({
    queryKey: queryKeys.picks.trending(),
    queryFn: async () => {
      const items = await picksTrending()
      return items
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Query for fetching AI-powered recommendations for the authenticated user.
 * Rate-limited: free users 1/day, paid users unlimited.
 */
export function useAiRecommendations() {
  return useQuery({
    queryKey: queryKeys.picks.aiRecs(),
    queryFn: async () => picksAiRecs(),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
  })
}

/**
 * Mutation to manually trigger new recommendations with optimistic UI.
 * Invalidates cached recommendations and fetches fresh ones.
 */
export function useRefreshPicks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Clear cache and re-fetch
      await queryClient.invalidateQueries({ queryKey: queryKeys.picks.trending() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.picks.aiRecs() })

      // Fetch fresh trending picks
      const trending = await picksTrending()

      return { trending }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.picks.trending() })
      await queryClient.cancelQueries({ queryKey: queryKeys.picks.aiRecs() })

      // Snapshot previous values
      const previousTrending = queryClient.getQueryData(queryKeys.picks.trending())
      const previousAiRecs = queryClient.getQueryData(queryKeys.picks.aiRecs())

      // Optimistically show a loading state
      queryClient.setQueryData(queryKeys.picks.trending(), (old: PicksItem[] | undefined) => old)
      queryClient.setQueryData(queryKeys.picks.aiRecs(), (old: Recommendation[] | undefined) => old)

      return { previousTrending, previousAiRecs }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousTrending) {
        queryClient.setQueryData(queryKeys.picks.trending(), context.previousTrending)
      }
      if (context?.previousAiRecs) {
        queryClient.setQueryData(queryKeys.picks.aiRecs(), context.previousAiRecs)
      }
    },
    onSuccess: () => {
      // Re-fetch both to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.picks.trending() })
      queryClient.invalidateQueries({ queryKey: queryKeys.picks.aiRecs() })
    },
  })
}

export const useAiRecs = useAiRecommendations

export function useTrending(enabled = true) {
  return useQuery({
    queryKey: queryKeys.picks.trending(),
    queryFn: async () => picksTrending(),
    staleTime: 10 * 60 * 1000,
    enabled,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { moodSearch, moodSearchRefresh } from '../lib/scoutApi'
import type { MoodSearchResponse, MoodSearchRefreshResponse } from '../lib/scoutApi'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

export interface MoodSearchItem {
  id: string
  query: string
  title: string
  resultTmdbIds: number[]
  createdAt: string
}

/**
 * Mutation to create a new mood search with optimistic UI.
 * Summarizes long queries, discovers top movies/TV, and ranks by mood match.
 * Rate-limited to 3/day for all users.
 */
export function useMoodSearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ query }: { query: string }) => {
      const response = await moodSearch(query)
      return response
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.moodSearch.history() })

      const previousHistory = queryClient.getQueryData(queryKeys.moodSearch.history())

      // Optimistically add a new search to history
      const optimisticSearch: MoodSearchItem = {
        id: `temp-${Date.now()}`,
        query: variables.query,
        title: variables.query,
        resultTmdbIds: [],
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData(queryKeys.moodSearch.history(), (old: MoodSearchItem[] | undefined) => {
        return old ? [optimisticSearch, ...old] : [optimisticSearch]
      })

      return { previousHistory }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousHistory) {
        queryClient.setQueryData(queryKeys.moodSearch.history(), context.previousHistory)
      }
    },
    onSuccess: () => {
      // Invalidate history to sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.moodSearch.history() })
    },
  })
}

/**
 * Mutation to refresh/re-rank results for an existing mood search by ID with optimistic UI.
 * Returns updated rankings for the same search query.
 */
export function useMoodSearchRefresh() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ searchId }: { searchId: string }) => {
      const response = await moodSearchRefresh(searchId)
      return response
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.moodSearch.results() })

      const previousResults = queryClient.getQueryData(queryKeys.moodSearch.results())

      // Keep showing old results while refreshing
      queryClient.setQueryData(queryKeys.moodSearch.results(), (old: any | undefined) => old)

      return { previousResults }
    },
    onError: (error, variables, context) => {
      if (context?.previousResults) {
        queryClient.setQueryData(queryKeys.moodSearch.results(), context.previousResults)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moodSearch.results() })
    },
  })
}

/**
 * Query for fetching the user's saved mood searches history.
 */
export function useMoodSearchHistory() {
  return useQuery({
    queryKey: queryKeys.moodSearch.history(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_searches')
        .select('id, query, title, result_tmdb_ids, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch mood search history: ${error.message}`)
      }

      // Transform snake_case to camelCase
      return (data || []).map((item: any) => ({
        id: item.id,
        query: item.query,
        title: item.title,
        resultTmdbIds: item.result_tmdb_ids || [],
        createdAt: item.created_at,
      })) as MoodSearchItem[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

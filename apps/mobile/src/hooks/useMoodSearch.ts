import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { moodSearch, moodSearchRefresh } from '../lib/scoutApi'
import type { MoodSearchResponse, MoodSearchRefreshResponse, MoodSearchResult } from '../lib/scoutApi'
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
      queryClient.invalidateQueries({ queryKey: queryKeys.moodSearch.history() })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.moodSearch.all(), 'usage'] })
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
 * Query for today's mood search usage count for the current user.
 * Used to show remaining searches in the footer (limit: 3/day).
 */
export function useMoodSearchUsage() {
  return useQuery({
    queryKey: [...queryKeys.moodSearch.all(), 'usage'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { used: 0, limit: 3 }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action', 'mood_search')
        .gte('created_at', today.toISOString())
      return { used: count ?? 0, limit: 3 }
    },
    staleTime: 60 * 1000,
  })
}

/**
 * Fetches full media data for a list of TMDB IDs from media_cache.
 * Used to display results for history items without burning rate-limit credits.
 */
export function useMoodSearchResults(tmdbIds: number[]) {
  return useQuery({
    queryKey: [...queryKeys.moodSearch.all(), 'results', tmdbIds],
    queryFn: async () => {
      if (tmdbIds.length === 0) return []
      const { data } = await supabase
        .from('media_cache')
        .select('tmdb_id, media_type, title, poster_path, backdrop_path, year, genres, overview')
        .in('tmdb_id', tmdbIds)
      const cacheMap = new Map((data ?? []).map((r: any) => [r.tmdb_id, r]))
      return tmdbIds
        .map(id => {
          const r = cacheMap.get(id)
          if (!r) return null
          return {
            tmdbId: r.tmdb_id,
            mediaType: r.media_type,
            title: r.title ?? '',
            overview: r.overview ?? '',
            posterPath: r.poster_path ?? null,
            backdropPath: r.backdrop_path ?? null,
            year: r.year ?? null,
            genres: r.genres ?? [],
          } as MoodSearchResult
        })
        .filter((r): r is MoodSearchResult => r !== null)
    },
    enabled: tmdbIds.length > 0,
    staleTime: 5 * 60 * 1000,
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

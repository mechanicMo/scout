import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaType } from '@scout/shared'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

export interface WatchHistoryItem {
  id: string
  userId: string
  tmdbId: number
  mediaType: MediaType
  watchedAt: string
  overallScore: number | null
  tags: string[]
}

/**
 * Query for fetching the user's watch history.
 * Returns items in reverse chronological order (most recent first).
 */
export function useWatchHistory() {
  return useQuery({
    queryKey: queryKeys.watchHistory.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watch_history')
        .select('*')
        .order('watched_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch watch history: ${error.message}`)
      return data as WatchHistoryItem[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Mutation to add an item to watch history with optimistic UI.
 * Automatically logs usage as 'watched' and updates watch history.
 */
export function useMarkWatched() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tmdbId,
      mediaType,
      score,
      tags = [],
    }: {
      tmdbId: number
      mediaType: MediaType
      score?: number | null
      tags?: string[]
    }) => {
      // Add to watch history
      const { data, error } = await supabase
        .from('watch_history')
        .insert({
          tmdb_id: tmdbId,
          media_type: mediaType,
          overall_score: score || null,
          tags: tags,
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to mark as watched: ${error.message}`)

      // Auto-log usage
      await supabase.from('usage_logs').insert({
        action: `watched:${mediaType}:${tmdbId}`,
      })

      return data as WatchHistoryItem
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchHistory.list() })

      const previousData = queryClient.getQueryData(queryKeys.watchHistory.list())

      const optimisticItem: WatchHistoryItem = {
        id: `temp-${Date.now()}`,
        userId: '', // Will be filled by server
        tmdbId: variables.tmdbId,
        mediaType: variables.mediaType,
        watchedAt: new Date().toISOString(),
        overallScore: variables.score || null,
        tags: variables.tags || [],
      }

      queryClient.setQueryData(queryKeys.watchHistory.list(), (old: WatchHistoryItem[] | undefined) => {
        return old ? [optimisticItem, ...old] : [optimisticItem]
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.watchHistory.list(), context.previousData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchHistory.list() })
    },
  })
}

/**
 * Mutation to remove an item from watch history with optimistic UI.
 */
export function useRemoveFromHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('watch_history').delete().eq('id', id)

      if (error) throw new Error(`Failed to remove from history: ${error.message}`)
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchHistory.list() })

      const previousData = queryClient.getQueryData(queryKeys.watchHistory.list())

      queryClient.setQueryData(queryKeys.watchHistory.list(), (old: WatchHistoryItem[] | undefined) => {
        return old ? old.filter((item) => item.id !== variables.id) : []
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.watchHistory.list(), context.previousData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchHistory.list() })
    },
  })
}

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
  // From media_cache
  title: string
  posterPath: string | null
  year: number | null
  genres: string[]
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
      if (!data || data.length === 0) return []

      // Batch-fetch media details from cache for titles, posters, etc.
      const tmdbIds = data.map((row: any) => row.tmdb_id)
      const { data: cacheData } = await supabase
        .from('media_cache')
        .select('tmdb_id, media_type, title, poster_path, year, genres')
        .in('tmdb_id', tmdbIds)

      const cacheMap = new Map(
        (cacheData ?? []).map((c: any) => [`${c.tmdb_id}-${c.media_type}`, c])
      )

      return data.map((row: any): WatchHistoryItem => {
        const cache = cacheMap.get(`${row.tmdb_id}-${row.media_type}`)
        return {
          id: row.id,
          userId: row.user_id,
          tmdbId: row.tmdb_id,
          mediaType: row.media_type,
          watchedAt: row.watched_at,
          overallScore: row.overall_score,
          tags: row.tags ?? [],
          title: cache?.title ?? 'Unknown',
          posterPath: cache?.poster_path ?? null,
          year: cache?.year ?? null,
          genres: cache?.genres ?? [],
        }
      })
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('watch_history')
        .insert({
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: mediaType,
          overall_score: score || null,
          tags: tags,
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to mark as watched: ${error.message}`)

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
        userId: 'optimistic',
        tmdbId: variables.tmdbId,
        mediaType: variables.mediaType,
        watchedAt: new Date().toISOString(),
        overallScore: variables.score || null,
        tags: variables.tags || [],
        title: '',
        posterPath: null,
        year: null,
        genres: [],
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
    mutationFn: async ({ tmdbId, mediaType }: { tmdbId: number; mediaType: MediaType }) => {
      const { error } = await supabase
        .from('watch_history')
        .delete()
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)

      if (error) throw new Error(`Failed to remove from history: ${error.message}`)
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchHistory.list() })

      const previousData = queryClient.getQueryData(queryKeys.watchHistory.list())

      queryClient.setQueryData(queryKeys.watchHistory.list(), (old: WatchHistoryItem[] | undefined) => {
        return old
          ? old.filter(item => !(item.tmdbId === variables.tmdbId && item.mediaType === variables.mediaType))
          : []
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

export function useAddToHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      item,
      score,
      tags = [],
    }: {
      item: { tmdbId: number; mediaType: MediaType; [key: string]: any }
      score?: number | null
      tags?: string[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('watch_history')
        .insert({
          user_id: user.id,
          tmdb_id: item.tmdbId,
          media_type: item.mediaType,
          overall_score: score ?? null,
          tags,
        })
        .select()
        .single()
      if (error) throw new Error(`Failed to add to history: ${error.message}`)
      return data as WatchHistoryItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchHistory.list() })
    },
  })
}

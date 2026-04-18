import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaType } from '@scout/shared'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

export interface WatchlistItem {
  id: string
  userId: string
  tmdbId: number
  mediaType: MediaType
  status: 'saved' | 'dismissed_not_now' | 'dismissed_never'
  watchingStatus: 'not_started' | 'watching' | 'completed' | 'dropped'
  currentSeason: number | null
  currentEpisode: number | null
  addedAt: string
  resurfaceAfter: string | null
}

/**
 * Query for fetching watchlist items with optional status filter.
 * Excludes permanently dismissed items by default.
 */
export function useWatchlist(status?: string) {
  return useQuery({
    queryKey: status ? queryKeys.watchlist.byStatus(status) : queryKeys.watchlist.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('status', status || 'saved')
        .order('added_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch watchlist: ${error.message}`)
      return data as WatchlistItem[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Mutation to add an item to the watchlist with optimistic UI.
 * Updates the status of existing items or creates a new watchlist entry.
 */
export function useAddToWatchlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tmdbId,
      mediaType,
      watchingStatus = 'not_started',
    }: {
      tmdbId: number
      mediaType: MediaType
      watchingStatus?: 'not_started' | 'watching' | 'completed' | 'dropped'
    }) => {
      const { data, error } = await supabase
        .from('watchlist')
        .upsert(
          {
            tmdb_id: tmdbId,
            media_type: mediaType,
            status: 'saved',
            watching_status: watchingStatus,
          },
          { onConflict: 'user_id,tmdb_id,media_type' },
        )
        .select()
        .single()

      if (error) throw new Error(`Failed to add to watchlist: ${error.message}`)
      return data as WatchlistItem
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlist.all() })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKeys.watchlist.all())

      // Optimistically update the cache with a new item
      const optimisticItem: WatchlistItem = {
        id: `temp-${Date.now()}`,
        userId: '', // Will be filled by server
        tmdbId: variables.tmdbId,
        mediaType: variables.mediaType,
        status: 'saved',
        watchingStatus: variables.watchingStatus || 'not_started',
        currentSeason: null,
        currentEpisode: null,
        addedAt: new Date().toISOString(),
        resurfaceAfter: null,
      }

      queryClient.setQueryData(queryKeys.watchlist.all(), (old: WatchlistItem[] | undefined) => {
        return old ? [optimisticItem, ...old] : [optimisticItem]
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.watchlist.all(), context.previousData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all() })
    },
  })
}

/**
 * Mutation to remove an item from the watchlist with optimistic UI.
 */
export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('watchlist').delete().eq('id', id)

      if (error) throw new Error(`Failed to remove from watchlist: ${error.message}`)
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlist.all() })

      const previousData = queryClient.getQueryData(queryKeys.watchlist.all())

      queryClient.setQueryData(queryKeys.watchlist.all(), (old: WatchlistItem[] | undefined) => {
        return old ? old.filter((item) => item.id !== variables.id) : []
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.watchlist.all(), context.previousData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all() })
    },
  })
}

/**
 * Mutation to update the status of a watchlist item with optimistic UI.
 * Handles status changes: watching, completed, dismissed_not_now, dismissed_never.
 */
export function useUpdateWatchlistStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      watchingStatus,
    }: {
      id: string
      status?: 'saved' | 'dismissed_not_now' | 'dismissed_never'
      watchingStatus?: 'not_started' | 'watching' | 'completed' | 'dropped'
    }) => {
      const updateData: any = {}
      if (status) updateData.status = status
      if (watchingStatus) updateData.watching_status = watchingStatus

      const { data, error } = await supabase
        .from('watchlist')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update watchlist status: ${error.message}`)
      return data as WatchlistItem
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlist.all() })

      const previousData = queryClient.getQueryData(queryKeys.watchlist.all())

      queryClient.setQueryData(queryKeys.watchlist.all(), (old: WatchlistItem[] | undefined) => {
        return old
          ? old.map((item) =>
              item.id === variables.id
                ? {
                    ...item,
                    status: variables.status || item.status,
                    watchingStatus: variables.watchingStatus || item.watchingStatus,
                  }
                : item,
            )
          : []
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.watchlist.all(), context.previousData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all() })
    },
  })
}

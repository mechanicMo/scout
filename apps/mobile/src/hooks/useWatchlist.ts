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
  // From media_cache
  title: string
  genres: string[]
  year: number | null
  posterPath: string | null
  backdropPath: string | null
  overview: string
  numberOfSeasons: number | null
  numberOfEpisodes: number | null
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
      if (!data || data.length === 0) return []

      // Batch-fetch media details from cache for titles, genres, etc.
      const tmdbIds = data.map((item: any) => item.tmdb_id)
      const { data: cacheData } = await supabase
        .from('media_cache')
        .select('tmdb_id, media_type, title, genres, year, poster_path, backdrop_path, overview, number_of_seasons, number_of_episodes')
        .in('tmdb_id', tmdbIds)

      const cacheMap = new Map(
        (cacheData ?? []).map((c: any) => [`${c.tmdb_id}-${c.media_type}`, c])
      )

      return data.map((item: any): WatchlistItem => {
        const cache = cacheMap.get(`${item.tmdb_id}-${item.media_type}`)
        return {
          id: item.id,
          userId: item.user_id,
          tmdbId: item.tmdb_id,
          mediaType: item.media_type,
          status: item.status,
          watchingStatus: item.watching_status,
          currentSeason: item.current_season,
          currentEpisode: item.current_episode,
          addedAt: item.added_at,
          resurfaceAfter: item.resurface_after,
          title: cache?.title ?? 'Unknown',
          genres: cache?.genres ?? [],
          year: cache?.year ?? null,
          posterPath: cache?.poster_path ?? null,
          backdropPath: cache?.backdrop_path ?? null,
          overview: cache?.overview ?? '',
          numberOfSeasons: cache?.number_of_seasons ?? null,
          numberOfEpisodes: cache?.number_of_episodes ?? null,
        }
      })
    },
    staleTime: 5 * 60 * 1000,
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
      // Optional media fields — passed by callers for optimistic UI, not stored here
      title?: string
      genres?: string[]
      year?: number | null
      posterPath?: string | null
      backdropPath?: string | null
      overview?: string
      runtime?: number | null
      [key: string]: any
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('watchlist')
        .upsert(
          {
            user_id: user.id,
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
        userId: 'optimistic',
        tmdbId: variables.tmdbId,
        mediaType: variables.mediaType,
        status: 'saved',
        watchingStatus: variables.watchingStatus || 'not_started',
        currentSeason: null,
        currentEpisode: null,
        addedAt: new Date().toISOString(),
        resurfaceAfter: null,
        title: variables.title ?? '',
        genres: variables.genres ?? [],
        year: variables.year ?? null,
        posterPath: variables.posterPath ?? null,
        backdropPath: variables.backdropPath ?? null,
        overview: variables.overview ?? '',
        numberOfSeasons: null,
        numberOfEpisodes: null,
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
      resurfaceAfter,
    }: {
      id: string
      status?: 'saved' | 'dismissed_not_now' | 'dismissed_never'
      watchingStatus?: 'not_started' | 'watching' | 'completed' | 'dropped'
      resurfaceAfter?: string
    }) => {
      const updateData: any = {}
      if (status) updateData.status = status
      if (watchingStatus) updateData.watching_status = watchingStatus
      if (resurfaceAfter) updateData.resurface_after = resurfaceAfter

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

export function useUpdateWatchingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      watchingStatus,
      currentSeason,
      currentEpisode,
    }: {
      id: string
      watchingStatus: 'not_started' | 'watching' | 'completed' | 'dropped'
      currentSeason?: number
      currentEpisode?: number
    }) => {
      const updateData: any = { watching_status: watchingStatus }
      if (currentSeason !== undefined) updateData.current_season = currentSeason
      if (currentEpisode !== undefined) updateData.current_episode = currentEpisode
      const { data, error } = await supabase
        .from('watchlist')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(`Failed to update watching status: ${error.message}`)
      return data as WatchlistItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all() })
    },
  })
}

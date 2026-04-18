import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TasteProfile } from '@scout/shared'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

/**
 * Query for fetching the current user's taste profile.
 */
export function useTasteProfile() {
  return useQuery({
    queryKey: queryKeys.tasteProfile.get(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taste_profiles')
        .select('*')
        .single()

      if (error) {
        // If no profile exists yet, return empty profile
        if (error.code === 'PGRST116') {
          return {
            id: '',
            userId: '',
            likedGenres: [],
            dislikedGenres: [],
            likedThemes: [],
            favoriteActors: [],
            services: [],
            notes: '',
            lastUpdated: new Date().toISOString(),
          } as TasteProfile
        }
        throw new Error(`Failed to fetch taste profile: ${error.message}`)
      }
      return data as TasteProfile
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Mutation to update the user's taste profile with optimistic UI.
 * Partial updates - only provided fields are updated.
 */
export function useUpdateTasteProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      updates: Partial<Omit<TasteProfile, 'id' | 'userId' | 'lastUpdated'>>,
    ) => {
      const updateData: any = {
        ...updates,
        liked_genres: updates.likedGenres,
        disliked_genres: updates.dislikedGenres,
        liked_themes: updates.likedThemes,
        favorite_actors: updates.favoriteActors,
        last_updated: new Date().toISOString(),
      }

      // Remove camelCase versions
      delete updateData.likedGenres
      delete updateData.dislikedGenres
      delete updateData.likedThemes
      delete updateData.favoriteActors

      const { data, error } = await supabase
        .from('taste_profiles')
        .update(updateData)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update taste profile: ${error.message}`)
      }

      return data as TasteProfile
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasteProfile.get() })

      const previousData = queryClient.getQueryData(queryKeys.tasteProfile.get())

      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.tasteProfile.get(), (old: TasteProfile | undefined) => {
        if (!old) return old

        return {
          ...old,
          likedGenres: variables.likedGenres ?? old.likedGenres,
          dislikedGenres: variables.dislikedGenres ?? old.dislikedGenres,
          likedThemes: variables.likedThemes ?? old.likedThemes,
          favoriteActors: variables.favoriteActors ?? old.favoriteActors,
          services: variables.services ?? old.services,
          notes: variables.notes ?? old.notes,
          lastUpdated: new Date().toISOString(),
        }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.tasteProfile.get(), context.previousData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasteProfile.get() })
    },
  })
}

export function useUpdateFromRating() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ score, genres }: { score: number; genres: string[] }) => {
      if (genres.length === 0 || (score > 3 && score < 7)) return null
      const field = score >= 7 ? 'liked_genres' : 'disliked_genres'
      const { data: profile } = await supabase.from('taste_profiles').select(field).single()
      const existing: string[] = (profile as any)?.[field] ?? []
      const merged = Array.from(new Set([...existing, ...genres]))
      const { data, error } = await supabase
        .from('taste_profiles')
        .update({ [field]: merged, last_updated: new Date().toISOString() })
        .select()
        .single()
      if (error) throw new Error(`Failed to update taste from rating: ${error.message}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasteProfile.get() })
    },
  })
}

export function useUpdateServices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ services }: { services: string[] }) => {
      const { data, error } = await supabase
        .from('taste_profiles')
        .update({ services, last_updated: new Date().toISOString() })
        .select()
        .single()
      if (error) throw new Error(`Failed to update services: ${error.message}`)
      return data as TasteProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasteProfile.get() })
    },
  })
}

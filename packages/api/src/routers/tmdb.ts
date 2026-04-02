import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { searchTMDB } from '@scout/shared'
import { CACHE_TTL_MS, isCacheStale, cacheRowToMediaItem, upsertMediaCache } from '../lib/mediaEnrich'
import { db, mediaCache, tasteProfiles } from '@scout/db'
import { eq, and } from 'drizzle-orm'
import { fetchMedia } from '@scout/shared'
import type { TasteProfile } from '@scout/shared'
import { GroqProvider } from '@scout/ai'

function getTMDBToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return token
}

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is required')
  return key
}

export const tmdbRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const results = await searchTMDB(input.query, getTMDBToken())
      return results
    }),

  getMedia: protectedProcedure
    .input(z.object({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(['movie', 'tv']),
    }))
    .query(async ({ input }) => {
      const { tmdbId, mediaType } = input

      const cached = await db
        .select()
        .from(mediaCache)
        .where(and(eq(mediaCache.tmdbId, tmdbId), eq(mediaCache.mediaType, mediaType)))
        .limit(1)

      const hit = cached[0]
      if (hit && !isCacheStale(hit.lastSynced, CACHE_TTL_MS)) {
        return cacheRowToMediaItem(hit)
      }

      const fresh = await fetchMedia(tmdbId, mediaType, getTMDBToken())
      await upsertMediaCache(fresh)
      return fresh
    }),

  generateTags: protectedProcedure
    .input(z.object({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(['movie', 'tv']),
    }))
    .query(async ({ ctx, input }) => {
      const { tmdbId, mediaType } = input

      const [hit] = await db
        .select()
        .from(mediaCache)
        .where(and(eq(mediaCache.tmdbId, tmdbId), eq(mediaCache.mediaType, mediaType)))
        .limit(1)

      if (!hit) return [] as string[]

      const media = cacheRowToMediaItem(hit)

      const [profileRow] = await db
        .select()
        .from(tasteProfiles)
        .where(eq(tasteProfiles.userId, ctx.userId))
        .limit(1)

      const profile: TasteProfile = profileRow
        ? {
            id: profileRow.id,
            userId: profileRow.userId,
            likedGenres: profileRow.likedGenres ?? [],
            dislikedGenres: profileRow.dislikedGenres ?? [],
            likedThemes: profileRow.likedThemes ?? [],
            favoriteActors: profileRow.favoriteActors ?? [],
            services: profileRow.services ?? [],
            notes: profileRow.notes ?? '',
            lastUpdated: profileRow.lastUpdated.toISOString(),
          }
        : {
            id: '', userId: ctx.userId, likedGenres: [], dislikedGenres: [],
            likedThemes: [], favoriteActors: [], services: [], notes: '',
            lastUpdated: new Date().toISOString(),
          }

      const groq = new GroqProvider(getGroqKey())
      return groq.generateTags(media, profile)
    }),
})

export type TMDBRouter = typeof tmdbRouter

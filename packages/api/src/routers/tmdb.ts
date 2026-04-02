import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { searchTMDB } from '@scout/shared'
import { CACHE_TTL_MS, isCacheStale, cacheRowToMediaItem, upsertMediaCache } from '../lib/mediaEnrich'
import { db, mediaCache } from '@scout/db'
import { eq, and } from 'drizzle-orm'
import { fetchMedia } from '@scout/shared'

function getTMDBToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return token
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
})

export type TMDBRouter = typeof tmdbRouter

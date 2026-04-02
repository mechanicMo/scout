import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { db, mediaCache } from '@scout/db'
import { fetchMedia, searchTMDB } from '@scout/shared'

function getTMDBToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return token
}
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000       // 7 days
const PROVIDERS_TTL_MS = 48 * 60 * 60 * 1000        // 48 hours

function isCacheStale(lastSynced: Date, ttlMs: number): boolean {
  return Date.now() - lastSynced.getTime() > ttlMs
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

      // Check cache
      const cached = await db
        .select()
        .from(mediaCache)
        .where(and(eq(mediaCache.tmdbId, tmdbId), eq(mediaCache.mediaType, mediaType)))
        .limit(1)

      const hit = cached[0]
      if (hit && !isCacheStale(hit.lastSynced, CACHE_TTL_MS)) {
        return {
          tmdbId: hit.tmdbId,
          mediaType: hit.mediaType,
          title: hit.title,
          posterPath: hit.posterPath,
          year: hit.year,
          genres: hit.genres,
          overview: hit.overview,
          runtime: hit.runtime,
          watchProviders: hit.watchProviders,
        }
      }

      // Fetch fresh from TMDB
      const fresh = await fetchMedia(tmdbId, mediaType, getTMDBToken())

      // Upsert into cache
      await db
        .insert(mediaCache)
        .values({
          tmdbId: fresh.tmdbId,
          mediaType: fresh.mediaType,
          title: fresh.title,
          posterPath: fresh.posterPath,
          year: fresh.year,
          genres: fresh.genres,
          overview: fresh.overview,
          runtime: fresh.runtime,
          watchProviders: fresh.watchProviders,
          lastSynced: new Date(),
        })
        .onConflictDoUpdate({
          target: [mediaCache.tmdbId, mediaCache.mediaType],
          set: {
            title: fresh.title,
            posterPath: fresh.posterPath,
            year: fresh.year,
            genres: fresh.genres,
            overview: fresh.overview,
            runtime: fresh.runtime,
            watchProviders: fresh.watchProviders,
            lastSynced: new Date(),
          },
        })

      return fresh
    }),
})

export type TMDBRouter = typeof tmdbRouter

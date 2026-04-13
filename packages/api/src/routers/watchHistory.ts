import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { db, watchHistory, mediaCache } from '@scout/db'

// watch_history is a log — duplicate (userId, tmdbId) rows are intentional.
// A user can watch the same movie multiple times.

const mediaInput = z.object({
  title: z.string(),
  posterPath: z.string().nullable(),
  year: z.number().nullable(),
  genres: z.array(z.string()),
  overview: z.string(),
  runtime: z.number().nullable(),
  watchProviders: z.record(z.any()),
}).optional()

export const watchHistoryRouter = router({
  add: protectedProcedure
    .input(z.object({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(['movie', 'tv']),
      score: z.number().int().min(1).max(5).optional(),
      tags: z.array(z.string()).optional(),
      media: mediaInput,
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert media into cache if provided, so list can join it later
      if (input.media) {
        await db
          .insert(mediaCache)
          .values({
            tmdbId: input.tmdbId,
            mediaType: input.mediaType,
            title: input.media.title,
            posterPath: input.media.posterPath,
            year: input.media.year,
            genres: input.media.genres,
            overview: input.media.overview,
            runtime: input.media.runtime,
            watchProviders: input.media.watchProviders,
            lastSynced: new Date(),
          })
          .onConflictDoUpdate({
            target: [mediaCache.tmdbId, mediaCache.mediaType],
            set: {
              title: input.media.title,
              posterPath: input.media.posterPath,
              year: input.media.year,
              genres: input.media.genres,
              overview: input.media.overview,
              runtime: input.media.runtime,
              lastSynced: new Date(),
            },
          })
      }

      const [row] = await db
        .insert(watchHistory)
        .values({
          userId: ctx.userId,
          tmdbId: input.tmdbId,
          mediaType: input.mediaType,
          overallScore: input.score ?? null,
          tags: input.tags ?? [],
        })
        .returning()

      if (!row) throw new Error('Failed to insert watch history')
      return { id: row.id }
    }),

  remove: protectedProcedure
    .input(z.object({ tmdbId: z.number().int(), mediaType: z.enum(['movie', 'tv']) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(watchHistory)
        .where(
          and(
            eq(watchHistory.userId, ctx.userId),
            eq(watchHistory.tmdbId, input.tmdbId),
            eq(watchHistory.mediaType, input.mediaType)
          )
        )
      return { success: true }
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return db
        .select({
          id: watchHistory.id,
          tmdbId: watchHistory.tmdbId,
          mediaType: watchHistory.mediaType,
          watchedAt: watchHistory.watchedAt,
          overallScore: watchHistory.overallScore,
          tags: watchHistory.tags,
          title: mediaCache.title,
          posterPath: mediaCache.posterPath,
          year: mediaCache.year,
        })
        .from(watchHistory)
        .leftJoin(
          mediaCache,
          and(
            eq(watchHistory.tmdbId, mediaCache.tmdbId),
            eq(watchHistory.mediaType, mediaCache.mediaType)
          )
        )
        .where(eq(watchHistory.userId, ctx.userId))
        .orderBy(desc(watchHistory.watchedAt))
    }),
})

export type WatchHistoryRouter = typeof watchHistoryRouter

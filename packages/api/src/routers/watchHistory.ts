import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { db, watchHistory, mediaCache } from '@scout/db'

export const watchHistoryRouter = router({
  add: protectedProcedure
    .input(z.object({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(['movie', 'tv']),
      score: z.number().int().min(1).max(5).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
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

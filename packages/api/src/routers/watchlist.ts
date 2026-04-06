import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { db, watchlist, mediaCache } from '@scout/db'

const mediaInput = z.object({
  title: z.string(),
  posterPath: z.string().nullable(),
  year: z.number().nullable(),
  genres: z.array(z.string()),
  overview: z.string(),
  runtime: z.number().nullable(),
  watchProviders: z.record(z.any()),
}).optional()

export const watchlistRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['saved', 'dismissed_not_now', 'dismissed_never']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const condition = and(
        eq(watchlist.userId, ctx.userId),
        input.status ? eq(watchlist.status, input.status) : undefined
      )

      return db
        .select({
          id: watchlist.id,
          tmdbId: watchlist.tmdbId,
          mediaType: watchlist.mediaType,
          status: watchlist.status,
          resurfaceAfter: watchlist.resurfaceAfter,
          watchingStatus: watchlist.watchingStatus,
          currentSeason: watchlist.currentSeason,
          currentEpisode: watchlist.currentEpisode,
          addedAt: watchlist.addedAt,
          title: mediaCache.title,
          posterPath: mediaCache.posterPath,
          year: mediaCache.year,
          genres: mediaCache.genres,
          overview: mediaCache.overview,
          numberOfSeasons: mediaCache.numberOfSeasons,
          numberOfEpisodes: mediaCache.numberOfEpisodes,
        })
        .from(watchlist)
        .leftJoin(
          mediaCache,
          and(
            eq(watchlist.tmdbId, mediaCache.tmdbId),
            eq(watchlist.mediaType, mediaCache.mediaType)
          )
        )
        .where(condition)
        .orderBy(desc(watchlist.addedAt))
    }),

  add: protectedProcedure
    .input(z.object({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(['movie', 'tv']),
      media: mediaInput,
      watchingStatus: z.enum(['not_started', 'watching', 'completed', 'dropped']).optional(),
      currentSeason: z.number().int().nonnegative().optional(),
      currentEpisode: z.number().int().nonnegative().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert media into cache if provided
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
        .insert(watchlist)
        .values({
          userId: ctx.userId,
          tmdbId: input.tmdbId,
          mediaType: input.mediaType,
          status: 'saved',
          watchingStatus: input.watchingStatus ?? 'not_started',
          currentSeason: input.currentSeason ?? null,
          currentEpisode: input.currentEpisode ?? null,
        })
        .onConflictDoUpdate({
          target: [watchlist.userId, watchlist.tmdbId, watchlist.mediaType],
          set: {
            status: 'saved',
            resurfaceAfter: null,
            watchingStatus: input.watchingStatus ?? 'not_started',
            currentSeason: input.currentSeason ?? null,
            currentEpisode: input.currentEpisode ?? null,
          },
        })
        .returning()

      if (!row) throw new Error('Failed to insert watchlist item')
      return { id: row.id }
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['saved', 'dismissed_not_now', 'dismissed_never']),
      resurfaceAfter: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(watchlist)
        .set({
          status: input.status,
          resurfaceAfter: input.resurfaceAfter ?? null,
        })
        .where(
          and(
            eq(watchlist.id, input.id),
            eq(watchlist.userId, ctx.userId)
          )
        )
      return { id: input.id }
    }),

  updateWatching: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      watchingStatus: z.enum(['not_started', 'watching', 'completed', 'dropped']),
      currentSeason: z.number().int().nonnegative().optional(),
      currentEpisode: z.number().int().nonnegative().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(watchlist)
        .set({
          watchingStatus: input.watchingStatus,
          currentSeason: input.currentSeason ?? null,
          currentEpisode: input.currentEpisode ?? null,
        })
        .where(
          and(
            eq(watchlist.id, input.id),
            eq(watchlist.userId, ctx.userId)
          )
        )
      return { id: input.id }
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(watchlist)
        .where(
          and(
            eq(watchlist.id, input.id),
            eq(watchlist.userId, ctx.userId)
          )
        )
      return { id: input.id }
    }),
})

export type WatchlistRouter = typeof watchlistRouter

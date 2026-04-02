// packages/api/src/routers/picks.ts
import { z } from 'zod'
import { eq, and, gt, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { fetchTrending } from '@scout/shared'
import { GroqProvider } from '@scout/ai'
import { db, recommendations, tasteProfiles, watchHistory } from '@scout/db'
import { getOrFetchMedia } from '../lib/mediaEnrich'
import type { TasteProfile, WatchedItem, Recommendation, MediaItem } from '@scout/shared'

const REC_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function getTMDBToken(): string {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return token
}

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is required')
  return key
}

async function enrichRecs(
  recList: Array<{ tmdbId: number; mediaType: string }>,
  tmdbToken: string
): Promise<MediaItem[]> {
  const results: MediaItem[] = []
  for (const rec of recList) {
    const media = await getOrFetchMedia(rec.tmdbId, rec.mediaType as 'movie' | 'tv', tmdbToken)
    if (media) results.push(media)
  }
  return results
}

export const picksRouter = router({
  trending: protectedProcedure
    .query(() => fetchTrending(getTMDBToken())),

  aiRecs: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId

      // 1. Check for fresh recs in DB
      const freshRecs = await db
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.userId, userId),
            eq(recommendations.status, 'pending'),
            gt(recommendations.generatedAt, new Date(Date.now() - REC_TTL_MS))
          )
        )
        .limit(20)

      if (freshRecs.length >= 5) {
        return enrichRecs(
          freshRecs.map(r => ({ tmdbId: r.tmdbId, mediaType: r.mediaType })),
          getTMDBToken()
        )
      }

      // 2. Get taste profile
      const profileRows = await db
        .select()
        .from(tasteProfiles)
        .where(eq(tasteProfiles.userId, userId))
        .limit(1)

      const profile = profileRows[0] ?? null
      const isSparse = !profile ||
        (profile.likedGenres.length === 0 && (profile.notes ?? '') === '' && profile.likedThemes.length === 0)

      if (isSparse) return [] // PicksScreen falls back to trending

      // 3. Get recent watch history
      const history = await db
        .select()
        .from(watchHistory)
        .where(eq(watchHistory.userId, userId))
        .orderBy(desc(watchHistory.watchedAt))
        .limit(20)

      // 4. Build typed profile + history for AI
      const tasteProfileInput: TasteProfile = {
        id: profile.id,
        userId: profile.userId,
        likedGenres: profile.likedGenres ?? [],
        dislikedGenres: profile.dislikedGenres ?? [],
        likedThemes: profile.likedThemes ?? [],
        favoriteActors: profile.favoriteActors ?? [],
        services: profile.services ?? [],
        notes: profile.notes ?? '',
        lastUpdated: profile.lastUpdated.toISOString(),
      }

      const watchedItems: WatchedItem[] = history.map(h => ({
        id: h.id,
        userId: h.userId,
        tmdbId: h.tmdbId,
        mediaType: h.mediaType,
        watchedAt: h.watchedAt.toISOString(),
        overallScore: h.overallScore ?? null,
        tags: h.tags ?? [],
      }))

      // 5. Generate recs via Groq
      const groq = new GroqProvider(getGroqKey())
      const rawRecs: Recommendation[] = await groq.generateRecommendations(tasteProfileInput, watchedItems)

      // 6. Store new recs (replace old pending ones)
      await db.delete(recommendations).where(
        and(eq(recommendations.userId, userId), eq(recommendations.status, 'pending'))
      )
      if (rawRecs.length > 0) {
        await db.insert(recommendations).values(
          rawRecs.map(r => ({ userId, tmdbId: r.tmdbId, mediaType: r.mediaType, status: 'pending' as const }))
        )
      }

      return enrichRecs(rawRecs, getTMDBToken())
    }),

  refine: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId

      // Get current recs for context
      const currentRecs = await db
        .select()
        .from(recommendations)
        .where(and(eq(recommendations.userId, userId), eq(recommendations.status, 'pending')))
        .limit(20)

      const profileRows = await db
        .select()
        .from(tasteProfiles)
        .where(eq(tasteProfiles.userId, userId))
        .limit(1)

      const profile = profileRows[0]

      const tasteProfileInput: TasteProfile = profile
        ? {
            id: profile.id,
            userId: profile.userId,
            likedGenres: profile.likedGenres ?? [],
            dislikedGenres: profile.dislikedGenres ?? [],
            likedThemes: profile.likedThemes ?? [],
            favoriteActors: profile.favoriteActors ?? [],
            services: profile.services ?? [],
            notes: profile.notes ?? '',
            lastUpdated: profile.lastUpdated.toISOString(),
          }
        : {
            id: '',
            userId,
            likedGenres: [],
            dislikedGenres: [],
            likedThemes: [],
            favoriteActors: [],
            services: [],
            notes: '',
            lastUpdated: new Date().toISOString(),
          }

      const currentRecsForAI: Recommendation[] = currentRecs.map(r => ({
        id: r.id,
        userId: r.userId,
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        generatedAt: r.generatedAt.toISOString(),
        status: r.status,
      }))

      const groq = new GroqProvider(getGroqKey())
      const rawRecs: Recommendation[] = await groq.refineRecommendations(input.message, currentRecsForAI, tasteProfileInput)

      // Replace stored recs with refined ones
      await db.delete(recommendations).where(
        and(eq(recommendations.userId, userId), eq(recommendations.status, 'pending'))
      )
      if (rawRecs.length > 0) {
        await db.insert(recommendations).values(
          rawRecs.map(r => ({ userId, tmdbId: r.tmdbId, mediaType: r.mediaType, status: 'pending' as const }))
        )
      }

      return enrichRecs(rawRecs, getTMDBToken())
    }),
})

export type PicksRouter = typeof picksRouter

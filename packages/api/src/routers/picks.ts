// packages/api/src/routers/picks.ts
import { z } from 'zod'
import { eq, and, gt, desc, gte, or, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { fetchTrending } from '@scout/shared'
import { GroqProvider } from '@scout/ai'
import { db, recommendations, tasteProfiles, watchHistory, usageLogs, users, watchlist } from '@scout/db'
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

async function checkRateLimit(
  userId: string,
  action: 'ai_recs' | 'refine',
  freeLimit: number
): Promise<void> {
  const [user] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId)).limit(1)
  if (!user || user.tier === 'paid') return

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [row] = await db
    .select({ count: count() })
    .from(usageLogs)
    .where(and(
      eq(usageLogs.userId, userId),
      eq(usageLogs.action, action),
      gte(usageLogs.createdAt, todayStart)
    ))
    .limit(1)

  const used = row?.count ?? 0
  if (used >= freeLimit) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Daily ${action} limit reached`,
    })
  }
}

async function logUsage(userId: string, action: 'ai_recs' | 'refine'): Promise<void> {
  await db.insert(usageLogs).values({ userId, action })
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
    .query(async ({ ctx }) => {
      const userId = ctx.userId
      const items = await fetchTrending(getTMDBToken())

      const today = new Date().toISOString().split('T')[0]

      const dismissed = await db
        .select({ tmdbId: watchlist.tmdbId, mediaType: watchlist.mediaType })
        .from(watchlist)
        .where(
          and(
            eq(watchlist.userId, userId),
            or(
              eq(watchlist.status, 'dismissed_never'),
              and(
                eq(watchlist.status, 'dismissed_not_now'),
                gt(watchlist.resurfaceAfter, today)
              )
            )
          )
        )

      const dismissedSet = new Set(dismissed.map(d => `${d.tmdbId}-${d.mediaType}`))
      return items.filter(i => !dismissedSet.has(`${i.tmdbId}-${i.mediaType}`))
    }),

  aiRecs: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId
      await checkRateLimit(userId, 'ai_recs', 1)

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

      await logUsage(userId, 'ai_recs')
      return enrichRecs(rawRecs, getTMDBToken())
    }),

  refine: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId
      await checkRateLimit(userId, 'refine', 3)

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

      await logUsage(userId, 'refine')
      return enrichRecs(rawRecs, getTMDBToken())
    }),
})

export type PicksRouter = typeof picksRouter

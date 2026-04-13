import { protectedProcedure, router } from '../trpc'
import { z } from 'zod'
import { db, moodSearches, users, tasteProfiles, usageLogs } from '@scout/db'
import { and, eq, gte, desc, count } from 'drizzle-orm'
import { GroqProvider } from '@scout/ai'
import { discoverTMDB, TMDB_GENRE_MAP } from '@scout/shared'
import { TRPCError } from '@trpc/server'
import { getOrFetchMedia } from '../lib/mediaEnrich'
import type { MediaItem, TasteProfile } from '@scout/shared'

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is required')
  return key
}

function getTMDBToken(): string {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return token
}

async function checkRateLimit(userId: string): Promise<void> {
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || user.tier === 'paid') return

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [row] = await db
    .select({ count: count() })
    .from(usageLogs)
    .where(and(
      eq(usageLogs.userId, userId),
      eq(usageLogs.action, 'mood_search'),
      gte(usageLogs.createdAt, todayStart)
    ))
    .limit(1)

  const used = row?.count ?? 0
  if (used >= 3) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Daily mood search limit reached',
    })
  }
}

async function logUsage(userId: string): Promise<void> {
  await db.insert(usageLogs).values({ userId, action: 'mood_search' })
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

export const moodSearchRouter = router({
  search: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId
      await checkRateLimit(userId)

      const groq = new GroqProvider(getGroqKey())
      const tmdbToken = getTMDBToken()

      // Step 1: Extract filters from message
      const filters = await groq.extractSearchFilters(input.message)

      // Step 2: Query TMDB discover
      const discoverPool: Array<{ tmdbId: number; mediaType: string; title: string; year: number | null; genres: string[]; overview: string }> = []
      const mediaTypes: Array<'movie' | 'tv'> = filters.mediaType === 'any'
        ? ['movie', 'tv']
        : [filters.mediaType as 'movie' | 'tv']

      for (const mt of mediaTypes) {
        const genreIds = filters.genres
          .map(g => TMDB_GENRE_MAP[g.toLowerCase()])
          .filter((id): id is number => id !== undefined)

        const results = await discoverTMDB({
          mediaType: mt,
          genres: genreIds.length > 0 ? genreIds : undefined,
          yearMin: filters.yearMin,
          yearMax: filters.yearMax,
        }, tmdbToken)

        for (const r of results) {
          discoverPool.push({
            tmdbId: r.tmdbId,
            mediaType: r.mediaType,
            title: r.title,
            year: r.year,
            genres: r.genres,
            overview: r.overview,
          })
        }
      }

      // Step 3: Get user's taste profile
      const [profileRow] = await db
        .select()
        .from(tasteProfiles)
        .where(eq(tasteProfiles.userId, userId))
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

      // Step 4: Rank results via LLM
      const rawRecs = await groq.refineRecommendations(
        input.message, [], profile, discoverPool
      )

      // Step 5: Generate title (verbatim if <=40 chars, else LLM summary)
      let title: string
      if (input.message.length <= 40) {
        title = input.message
      } else {
        // Call LLM to generate short summary
        const summaryQuestion = await groq.generateSurveyQuestion(profile, [])
        title = summaryQuestion?.question || input.message.slice(0, 40)
      }

      // Step 6: Enforce 10-item cap on user's searches
      const userSearches = await db
        .select()
        .from(moodSearches)
        .where(eq(moodSearches.userId, userId))
        .orderBy(desc(moodSearches.createdAt))

      if (userSearches.length >= 10) {
        const toDelete = userSearches.slice(9)
        for (const search of toDelete) {
          await db.delete(moodSearches).where(eq(moodSearches.id, search.id))
        }
      }

      // Step 7: Store search + results
      const [inserted] = await db
        .insert(moodSearches)
        .values({
          userId,
          query: input.message,
          title,
          resultTmdbIds: JSON.stringify(
            rawRecs.map(r => ({ tmdbId: r.tmdbId, mediaType: r.mediaType }))
          ),
        })
        .returning()

      if (!inserted) throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save mood search',
      })

      // Step 8: Log usage
      await logUsage(userId)

      // Step 9: Enrich and return
      const enriched = await enrichRecs(rawRecs, tmdbToken)
      return {
        searchId: inserted.id,
        title: inserted.title,
        results: enriched,
      }
    }),
})

export type MoodSearchRouter = typeof moodSearchRouter

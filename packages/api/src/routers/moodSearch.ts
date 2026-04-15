import { protectedProcedure, router } from '../trpc'
import { z } from 'zod'
import { db, moodSearches, users, tasteProfiles, usageLogs } from '@scout/db'
import { and, eq, gte, desc, count, sql, inArray } from 'drizzle-orm'
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
  const results = await Promise.all(
    recList.map(rec =>
      getOrFetchMedia(rec.tmdbId, rec.mediaType as 'movie' | 'tv', tmdbToken)
        .catch(() => null)
    )
  )
  return results.filter((m): m is MediaItem => m !== null)
}

async function discoverAndRank(
  query: string,
  groq: GroqProvider,
  tmdbToken: string,
  userId: string,
  profile: TasteProfile
): Promise<Array<{ tmdbId: number; mediaType: string }>> {
  const filters = await groq.extractSearchFilters(query)

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

  const rawRecs = await groq.refineRecommendations(query, [], profile, discoverPool)
  return rawRecs.map(r => ({ tmdbId: r.tmdbId, mediaType: r.mediaType }))
}

export const moodSearchRouter = router({
  search: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId
      console.log(`[mood-search] Starting search for user ${userId}: "${input.message}"`)
      await checkRateLimit(userId)

      const groq = new GroqProvider(getGroqKey())
      const tmdbToken = getTMDBToken()

      // Step 1: Get user's taste profile
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

      // Step 2: Discover and rank results
      console.log(`[mood-search] Extracting filters and discovering results...`)
      const idsToStore = await discoverAndRank(input.message, groq, tmdbToken, userId, profile)
      console.log(`[mood-search] Found ${idsToStore.length} results`)

      // Step 3: Generate title (verbatim if <=40 chars, else build from filters)
      let title: string
      if (input.message.length <= 40) {
        title = input.message
      } else {
        // For longer messages, build a short title from the extracted filters
        const filters = await groq.extractSearchFilters(input.message)
        const titleParts: string[] = []

        // Add mood if available
        if (filters.mood) {
          titleParts.push(filters.mood)
        }

        // Add up to 2 genres
        if (filters.genres.length > 0) {
          titleParts.push(...filters.genres.slice(0, 2))
        }

        // Add first keyword if available
        if (filters.keywords && filters.keywords.length > 0) {
          titleParts.push(filters.keywords[0])
        }

        // Combine into title (max 60 chars total)
        title = titleParts
          .filter(Boolean)
          .join(' ')
          .slice(0, 60)

        // Fallback to truncated message if no filters resulted in a title
        if (!title) {
          title = input.message.slice(0, 40)
        }
      }

      // Step 4: Enforce 10-item cap on user's searches
      const userSearches = await db
        .select()
        .from(moodSearches)
        .where(eq(moodSearches.userId, userId))
        .orderBy(desc(moodSearches.createdAt))

      if (userSearches.length >= 10) {
        const toDeleteIds = userSearches.slice(9).map(s => s.id)
        await db.delete(moodSearches).where(inArray(moodSearches.id, toDeleteIds))
      }

      // Step 5: Store search + results
      const [inserted] = await db
        .insert(moodSearches)
        .values({
          userId,
          query: input.message,
          title,
          resultTmdbIds: idsToStore,
        })
        .returning()

      if (!inserted) throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save mood search',
      })

      // Step 6: Log usage
      await logUsage(userId)

      // Step 7: Enrich and return
      const enriched = await enrichRecs(idsToStore, tmdbToken)
      return {
        searchId: inserted.id,
        title: inserted.title,
        results: enriched,
      }
    }),

  refresh: protectedProcedure
    .input(z.object({ searchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId
      await checkRateLimit(userId)

      const [search] = await db
        .select()
        .from(moodSearches)
        .where(and(eq(moodSearches.id, input.searchId), eq(moodSearches.userId, userId)))
        .limit(1)

      if (!search) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Search not found',
        })
      }

      const groq = new GroqProvider(getGroqKey())
      const tmdbToken = getTMDBToken()

      // Get user's taste profile
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

      // Re-run the same search with fresh TMDB data
      const idsToStore = await discoverAndRank(search.query, groq, tmdbToken, userId, profile)

      // Update the stored results and timestamp
      await db
        .update(moodSearches)
        .set({
          resultTmdbIds: idsToStore,
          updatedAt: new Date(),
        })
        .where(eq(moodSearches.id, input.searchId))

      await logUsage(userId)

      const enriched = await enrichRecs(idsToStore, tmdbToken)
      return enriched
    }),

  history: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId
      const searches = await db
        .select({
          id: moodSearches.id,
          title: moodSearches.title,
          resultCount: sql<number>`jsonb_array_length(${moodSearches.resultTmdbIds})`,
          createdAt: moodSearches.createdAt,
        })
        .from(moodSearches)
        .where(eq(moodSearches.userId, userId))
        .orderBy(desc(moodSearches.createdAt), desc(moodSearches.id))
        .limit(10)

      return searches
    }),

  results: protectedProcedure
    .input(z.object({ searchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId
      const [search] = await db
        .select()
        .from(moodSearches)
        .where(and(eq(moodSearches.id, input.searchId), eq(moodSearches.userId, userId)))
        .limit(1)

      if (!search) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Search not found',
        })
      }

      const parsed = search.resultTmdbIds as unknown as Array<{ tmdbId: number; mediaType: string }>
      const tmdbToken = getTMDBToken()
      return enrichRecs(parsed, tmdbToken)
    }),
})

export type MoodSearchRouter = typeof moodSearchRouter

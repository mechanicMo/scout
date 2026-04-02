// packages/api/src/routers/tasteProfile.ts
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { db, tasteProfiles } from '@scout/db'

async function getOrCreateProfile(userId: string) {
  const existing = await db
    .select().from(tasteProfiles).where(eq(tasteProfiles.userId, userId)).limit(1)
  if (existing[0]) return existing[0]
  const [created] = await db
    .insert(tasteProfiles)
    .values({ userId, likedGenres: [], dislikedGenres: [], likedThemes: [], favoriteActors: [], services: [], notes: '' })
    .returning()
  if (!created) throw new Error('Failed to create taste profile')
  return created
}

export const tasteProfileRouter = router({
  get: protectedProcedure
    .query(async ({ ctx }) => getOrCreateProfile(ctx.userId)),

  updateFromRating: protectedProcedure
    .input(z.object({
      score: z.number().int().min(1).max(5),
      genres: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await getOrCreateProfile(ctx.userId)
      const isPositive = input.score >= 3
      const existingLiked = profile.likedGenres ?? []
      const existingDisliked = profile.dislikedGenres ?? []

      const newLiked = isPositive
        ? Array.from(new Set([...existingLiked, ...input.genres]))
        : existingLiked.filter(g => !input.genres.includes(g))

      const newDisliked = !isPositive
        ? Array.from(new Set([...existingDisliked, ...input.genres]))
        : existingDisliked.filter(g => !input.genres.includes(g))

      const [updated] = await db
        .update(tasteProfiles)
        .set({ likedGenres: newLiked, dislikedGenres: newDisliked, lastUpdated: new Date() })
        .where(eq(tasteProfiles.userId, ctx.userId))
        .returning()
      if (!updated) throw new Error('Failed to update taste profile')
      return updated
    }),

  updateServices: protectedProcedure
    .input(z.object({ services: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await getOrCreateProfile(ctx.userId)
      const [updated] = await db
        .update(tasteProfiles)
        .set({ services: input.services, lastUpdated: new Date() })
        .where(eq(tasteProfiles.userId, ctx.userId))
        .returning()
      if (!updated) throw new Error('Failed to update services')
      return updated
    }),
})

export type TasteProfileRouter = typeof tasteProfileRouter

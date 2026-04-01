import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { db, users } from '@scout/db'

export const userRouter = router({
  upsert: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      displayName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(users)
        .values({
          id: ctx.userId,
          email: input.email,
          displayName: input.displayName,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: input.email,
            displayName: input.displayName,
          },
        })
      return { id: ctx.userId }
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1)

      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' })
      return user
    }),
})

export type UserRouter = typeof userRouter

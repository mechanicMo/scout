import { initTRPC, TRPCError } from '@trpc/server'
import type { TRPCContext } from './context'

const t = initTRPC.context<TRPCContext>().create()

export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

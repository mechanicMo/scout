// packages/api/src/routers/picks.ts
import { router, protectedProcedure } from '../trpc'
import { fetchTrending } from '@scout/shared'

function getTMDBToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is required')
  return token
}

export const picksRouter = router({
  trending: protectedProcedure
    .query(() => fetchTrending(getTMDBToken())),
})

export type PicksRouter = typeof picksRouter

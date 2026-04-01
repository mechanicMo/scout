import { router } from './trpc'
import { tmdbRouter } from './routers/tmdb'

export const appRouter = router({
  tmdb: tmdbRouter,
})

export type AppRouter = typeof appRouter

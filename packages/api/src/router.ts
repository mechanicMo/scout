import { router } from './trpc'
import { tmdbRouter } from './routers/tmdb'
import { userRouter } from './routers/user'

export const appRouter = router({
  tmdb: tmdbRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter

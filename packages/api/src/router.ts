import { router } from './trpc'
import { tmdbRouter } from './routers/tmdb'
import { userRouter } from './routers/user'
import { watchlistRouter } from './routers/watchlist'

export const appRouter = router({
  tmdb: tmdbRouter,
  user: userRouter,
  watchlist: watchlistRouter,
})

export type AppRouter = typeof appRouter

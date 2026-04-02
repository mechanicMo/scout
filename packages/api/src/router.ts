import { router } from './trpc'
import { tmdbRouter } from './routers/tmdb'
import { userRouter } from './routers/user'
import { watchlistRouter } from './routers/watchlist'
import { watchHistoryRouter } from './routers/watchHistory'

export const appRouter = router({
  tmdb: tmdbRouter,
  user: userRouter,
  watchlist: watchlistRouter,
  watchHistory: watchHistoryRouter,
})

export type AppRouter = typeof appRouter

import { router } from './trpc'
import { tmdbRouter } from './routers/tmdb'
import { userRouter } from './routers/user'
import { watchlistRouter } from './routers/watchlist'
import { watchHistoryRouter } from './routers/watchHistory'
import { tasteProfileRouter } from './routers/tasteProfile'
import { picksRouter } from './routers/picks'

export const appRouter = router({
  tmdb: tmdbRouter,
  user: userRouter,
  watchlist: watchlistRouter,
  watchHistory: watchHistoryRouter,
  tasteProfile: tasteProfileRouter,
  picks: picksRouter,
})

export type AppRouter = typeof appRouter

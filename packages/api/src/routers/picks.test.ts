// packages/api/src/routers/picks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@scout/shared', () => ({ fetchTrending: vi.fn() }))

import { createCallerFactory } from '../trpc'
import { picksRouter } from './picks'
import { fetchTrending } from '@scout/shared'

const createCaller = createCallerFactory(picksRouter)

const MOCK_ITEMS = [
  { tmdbId: 550, mediaType: 'movie' as const, title: 'Fight Club', posterPath: '/p.jpg', backdropPath: null, year: 1999, genres: [], tagline: null, overview: '', runtime: null, voteAverage: null, director: null, createdBy: [], cast: [], contentRating: null, numberOfSeasons: null, numberOfEpisodes: null, statusText: null, network: null, watchProviders: {} },
]

describe('picks.trending', () => {
  beforeEach(() => { vi.mocked(fetchTrending).mockResolvedValue(MOCK_ITEMS) })

  it('returns trending items', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.trending()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Fight Club')
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.trending()).rejects.toThrow()
  })
})

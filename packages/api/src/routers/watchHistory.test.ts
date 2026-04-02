import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 'abc-123' }]),
}))

vi.mock('@scout/db', () => ({
  db: mockDb,
  watchHistory: {
    id: 'id', userId: 'user_id', tmdbId: 'tmdb_id', mediaType: 'media_type',
    watchedAt: 'watched_at', overallScore: 'overall_score', tags: 'tags',
  },
  mediaCache: {
    tmdbId: 'tmdb_id', mediaType: 'media_type', title: 'title',
    posterPath: 'poster_path', year: 'year',
  },
}))

import { createCallerFactory } from '../trpc'
import { watchHistoryRouter } from './watchHistory'

const createCaller = createCallerFactory(watchHistoryRouter)

describe('watchHistory.add', () => {
  beforeEach(() => {
    mockDb.insert.mockClear()
    mockDb.returning.mockResolvedValue([{ id: 'abc-123' }])
  })

  it('inserts a watch history row and returns the id', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.add({ tmdbId: 550, mediaType: 'movie', score: 4, tags: ['intense', 'classic'] })
    expect(result).toEqual({ id: 'abc-123' })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('works without score or tags', async () => {
    const caller = createCaller({ userId: 'user-2' })
    const result = await caller.add({ tmdbId: 1396, mediaType: 'tv' })
    expect(result).toEqual({ id: 'abc-123' })
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.add({ tmdbId: 550, mediaType: 'movie' })).rejects.toThrow()
  })
})

describe('watchHistory.list', () => {
  it('returns watch history items joined with media cache', async () => {
    const mockItems = [{
      id: 'abc-123', tmdbId: 550, mediaType: 'movie',
      watchedAt: new Date(), overallScore: 4, tags: ['classic'],
      title: 'Fight Club', posterPath: '/poster.jpg', year: 1999,
    }]
    mockDb.orderBy.mockResolvedValueOnce(mockItems)

    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.list()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Fight Club')
  })

  it('returns empty array when no history', async () => {
    mockDb.orderBy.mockResolvedValueOnce([])
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.list()
    expect(result).toHaveLength(0)
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.list()).rejects.toThrow()
  })
})

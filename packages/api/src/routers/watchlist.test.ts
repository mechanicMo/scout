import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory } from '../trpc'
import { watchlistRouter } from './watchlist'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  returning: vi.fn().mockResolvedValue([{ id: 'new-uuid' }]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
}))

vi.mock('@scout/db', () => ({
  db: mockDb,
  watchlist: {
    id: 'id', userId: 'user_id', tmdbId: 'tmdb_id', mediaType: 'media_type',
    status: 'status', resurfaceAfter: 'resurface_after', addedAt: 'added_at',
  },
  mediaCache: {
    tmdbId: 'tmdb_id', mediaType: 'media_type', title: 'title',
    posterPath: 'poster_path', year: 'year', genres: 'genres',
    overview: 'overview', lastSynced: 'last_synced',
  },
}))

const createCaller = createCallerFactory(watchlistRouter)
const caller = createCaller({ userId: 'user-123' })

describe('watchlist.list', () => {
  it('returns watchlist items joined with media cache', async () => {
    const mockItems = [{
      id: 'wl-1', tmdbId: 550, mediaType: 'movie', status: 'saved',
      resurfaceAfter: null, addedAt: new Date(),
      title: 'Fight Club', posterPath: '/poster.jpg', year: 1999,
      genres: ['Drama'], overview: 'An insomniac...',
    }]
    mockDb.orderBy.mockResolvedValueOnce(mockItems)

    const result = await caller.list({})
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Fight Club')
  })

  it('returns empty array when watchlist is empty', async () => {
    mockDb.orderBy.mockResolvedValueOnce([])
    const result = await caller.list({})
    expect(result).toHaveLength(0)
  })
})

describe('watchlist.add', () => {
  beforeEach(() => {
    mockDb.insert.mockClear()
    mockDb.limit.mockResolvedValue([])
    mockDb.returning.mockResolvedValue([{ id: 'new-uuid' }])
  })

  it('inserts new watchlist row when item not in list', async () => {
    const result = await caller.add({ tmdbId: 550, mediaType: 'movie' })
    expect(result.id).toBe('new-uuid')
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('upserts media cache when media data is provided', async () => {
    await caller.add({
      tmdbId: 550,
      mediaType: 'movie',
      media: {
        title: 'Fight Club', posterPath: '/poster.jpg', year: 1999,
        genres: ['Drama'], overview: 'An insomniac...', runtime: 139,
        watchProviders: {},
      },
    })
    // insert called at least twice: once for mediaCache, once for watchlist
    expect(mockDb.insert).toHaveBeenCalledTimes(2)
  })
})

describe('watchlist.updateStatus', () => {
  it('updates status on watchlist item', async () => {
    await caller.updateStatus({ id: 'wl-1', status: 'dismissed_never' })
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalled()
  })
})

describe('watchlist.remove', () => {
  it('deletes watchlist item by id', async () => {
    await caller.remove({ id: 'wl-1' })
    expect(mockDb.delete).toHaveBeenCalled()
  })
})

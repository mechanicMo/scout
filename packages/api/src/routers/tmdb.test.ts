import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory } from '../trpc'
import { tmdbRouter } from './tmdb'
import { fetchMedia, searchTMDB } from '@scout/shared'

vi.mock('@scout/shared', () => ({
  fetchMedia: vi.fn(),
  searchTMDB: vi.fn(),
}))

vi.mock('@scout/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  },
  mediaCache: { tmdbId: 'tmdb_id', mediaType: 'media_type' },
}))

const createCaller = createCallerFactory(tmdbRouter)
const caller = createCaller({ userId: 'test-user' })

describe('tmdb.search', () => {
  it('returns search results from TMDB', async () => {
    const mockResults = [
      {
        tmdbId: 550,
        mediaType: 'movie' as const,
        title: 'Fight Club',
        posterPath: null,
        year: 1999,
        genres: [],
        overview: '',
        runtime: null,
        watchProviders: {},
      },
    ]
    vi.mocked(searchTMDB).mockResolvedValueOnce(mockResults)

    const result = await caller.search({ query: 'fight club' })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Fight Club')
  })
})

describe('tmdb.getMedia', () => {
  it('returns cached media when fresh', async () => {
    // Return a cached item with recent lastSynced
    const cachedItem = {
      tmdbId: 550,
      mediaType: 'movie' as const,
      title: 'Fight Club',
      posterPath: null,
      year: 1999,
      genres: ['Drama'],
      overview: 'An insomniac...',
      runtime: 139,
      watchProviders: {},
      lastSynced: new Date(), // just now = fresh
    }
    const db = (await import('@scout/db')).db
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([cachedItem]),
        }),
      }),
    } as any)

    const result = await caller.getMedia({ tmdbId: 550, mediaType: 'movie' })
    expect(result.title).toBe('Fight Club')
    expect(fetchMedia).not.toHaveBeenCalled()
  })
})

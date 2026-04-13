import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory } from '../trpc'
import { tmdbRouter } from './tmdb'
import { fetchMedia, searchTMDB } from '@scout/shared'

vi.mock('@scout/ai', () => ({
  GroqProvider: vi.fn().mockImplementation(() => ({
    generateTags: vi.fn().mockResolvedValue(['slow burn', 'strong performances', 'dark themes']),
  })),
}))

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
  tasteProfiles: { userId: 'user_id' },
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
        backdropPath: null,
        year: 1999,
        genres: [],
        tagline: null,
        overview: '',
        runtime: null,
        voteAverage: null,
        director: null,
        createdBy: [],
        cast: [],
        contentRating: null,
        numberOfSeasons: null,
        numberOfEpisodes: null,
        statusText: null,
        network: null,
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

describe('tmdb.generateTags', () => {
  it('returns AI-generated tags when media is cached', async () => {
    const cachedItem = {
      tmdbId: 550,
      mediaType: 'movie' as const,
      title: 'Fight Club',
      posterPath: null,
      backdropPath: null,
      year: 1999,
      genres: ['Drama', 'Thriller'],
      tagline: null,
      overview: 'A man joins a fight club.',
      runtime: 139,
      voteAverage: 8.8,
      director: 'David Fincher',
      createdBy: [],
      cast: [],
      contentRating: 'R',
      numberOfSeasons: null,
      numberOfEpisodes: null,
      statusText: null,
      network: null,
      watchProviders: {},
      lastSynced: new Date(),
    }
    const { db } = await import('@scout/db')
    // First select: cache hit. Second select: no taste profile.
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([cachedItem]),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

    const authedCaller = createCaller({ userId: 'user-1' })
    const result = await authedCaller.generateTags({ tmdbId: 550, mediaType: 'movie' })
    expect(result).toEqual(['slow burn', 'strong performances', 'dark themes'])
  })

  it('returns empty array when media is not cached', async () => {
    const { db } = await import('@scout/db')
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any)

    const authedCaller = createCaller({ userId: 'user-1' })
    const result = await authedCaller.generateTags({ tmdbId: 999, mediaType: 'movie' })
    expect(result).toEqual([])
  })

  it('throws when unauthenticated', async () => {
    const anonCaller = createCaller({ userId: null })
    await expect(anonCaller.generateTags({ tmdbId: 550, mediaType: 'movie' })).rejects.toThrow()
  })
})

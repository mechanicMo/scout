// packages/api/src/routers/picks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures mockDb is available when vi.mock factories are hoisted
const { mockDb, resetMockDbChain } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
  }

  function resetMockDbChain() {
    for (const key of Object.keys(mockDb) as Array<keyof typeof mockDb>) {
      ;(mockDb[key] as ReturnType<typeof vi.fn>).mockReturnValue(mockDb)
    }
  }

  resetMockDbChain()

  return { mockDb, resetMockDbChain }
})

vi.mock('@scout/shared', () => ({
  fetchTrending: vi.fn(),
  discoverTMDB: vi.fn().mockResolvedValue([
    { tmdbId: 680, mediaType: 'movie', title: 'Pulp Fiction', year: 1994, genres: ['Drama'], overview: 'A great film' },
  ]),
  TMDB_GENRE_MAP: { 'drama': 18, 'action': 28 },
}))

vi.mock('@scout/db', () => ({
  db: mockDb,
  mediaCache: {},
  recommendations: {},
  tasteProfiles: {},
  watchHistory: {},
  usageLogs: { userId: 'user_id', action: 'action', createdAt: 'created_at' },
  users: { id: 'id', tier: 'tier' },
  watchlist: { userId: 'user_id', tmdbId: 'tmdb_id', mediaType: 'media_type', status: 'status', resurfaceAfter: 'resurface_after' },
}))

vi.mock('@scout/ai', () => ({
  GroqProvider: vi.fn().mockImplementation(() => ({
    generateRecommendations: vi.fn().mockResolvedValue([
      { tmdbId: 550, mediaType: 'movie', id: '', userId: 'user-1', generatedAt: new Date().toISOString(), status: 'pending' },
      { tmdbId: 1396, mediaType: 'tv', id: '', userId: 'user-1', generatedAt: new Date().toISOString(), status: 'pending' },
    ]),
    extractSearchFilters: vi.fn().mockResolvedValue({
      mediaType: 'any',
      genres: ['Drama'],
      yearMin: undefined,
      yearMax: undefined,
    }),
    refineRecommendations: vi.fn().mockResolvedValue([
      { tmdbId: 680, mediaType: 'movie', id: '', userId: 'user-1', generatedAt: new Date().toISOString(), status: 'pending' },
    ]),
  })),
}))

vi.mock('../lib/mediaEnrich', () => ({
  getOrFetchMedia: vi.fn().mockImplementation(async (tmdbId: number, mediaType: string) => ({
    tmdbId, mediaType, title: `Movie ${tmdbId}`, posterPath: null, backdropPath: null,
    year: 2020, genres: ['Drama'], tagline: null, overview: 'Great film', runtime: 120,
    voteAverage: 8.0, director: null, createdBy: [], cast: [], contentRating: null,
    numberOfSeasons: null, numberOfEpisodes: null, statusText: null, network: null, watchProviders: {},
  })),
}))

// Set required env vars before importing picks router
process.env.GROQ_API_KEY = 'test-groq-key'
process.env.TMDB_READ_ACCESS_TOKEN = 'test-tmdb-token'

import { createCallerFactory } from '../trpc'
import { picksRouter } from './picks'
import { fetchTrending } from '@scout/shared'

const createCaller = createCallerFactory(picksRouter)

const MOCK_ITEMS = [
  { tmdbId: 550, mediaType: 'movie' as const, title: 'Fight Club', posterPath: '/p.jpg', backdropPath: null, year: 1999, genres: [], tagline: null, overview: '', runtime: null, voteAverage: null, director: null, createdBy: [], cast: [], contentRating: null, numberOfSeasons: null, numberOfEpisodes: null, statusText: null, network: null, watchProviders: {} },
]

describe('picks.trending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbChain()
    vi.mocked(fetchTrending).mockResolvedValue(MOCK_ITEMS)
    mockDb.where.mockResolvedValue([]) // no dismissed items
  })

  it('returns trending items', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.trending()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Fight Club')
  })

  it('filters out dismissed items', async () => {
    mockDb.where.mockResolvedValue([{ tmdbId: 550, mediaType: 'movie' }])
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.trending()
    expect(result).toHaveLength(0)
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.trending()).rejects.toThrow()
  })
})

describe('picks.aiRecs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbChain()
    mockDb.limit.mockResolvedValue([])
    mockDb.orderBy.mockReturnValue(mockDb)
  })

  it('returns empty array when profile is sparse', async () => {
    mockDb.limit
      .mockResolvedValueOnce([]) // fresh recs
      .mockResolvedValueOnce([{ tier: 'paid' }]) // user tier (paid skips count check)
      .mockResolvedValueOnce([]) // taste profile (sparse → isSparse = true)
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.aiRecs()
    expect(result).toEqual([])
  })

  it('returns enriched media items when profile has data', async () => {
    mockDb.limit
      .mockResolvedValueOnce([]) // fresh recs
      .mockResolvedValueOnce([{ tier: 'paid' }]) // user tier (paid skips count check)
      .mockResolvedValueOnce([{  // taste profile with data
        id: 'tp-1', userId: 'user-1',
        likedGenres: ['Drama'], dislikedGenres: [], likedThemes: [],
        favoriteActors: [], services: [], notes: '',
        lastUpdated: new Date(),
      }])
      .mockResolvedValueOnce([]) // watch history
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.aiRecs()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('title')
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.aiRecs()).rejects.toThrow()
  })
})


describe('picks.aiRecs rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbChain()
    mockDb.limit.mockResolvedValue([])
    mockDb.orderBy.mockReturnValue(mockDb)
  })

  it('allows paid users regardless of usage count', async () => {
    mockDb.limit
      .mockResolvedValueOnce([]) // no fresh recs
      .mockResolvedValueOnce([{ tier: 'paid' }]) // user tier — paid, skip count check
      .mockResolvedValueOnce([{
        id: 'tp-1', userId: 'user-1', likedGenres: ['Drama'], dislikedGenres: [],
        likedThemes: [], favoriteActors: [], services: [], notes: '',
        lastUpdated: new Date(),
      }]) // taste profile with data
      .mockResolvedValueOnce([]) // watch history (via orderBy→limit chain)
    const caller = createCaller({ userId: 'user-1' })
    await expect(caller.aiRecs()).resolves.toBeDefined()
  })

  it('blocks free user who has already generated recs today', async () => {
    mockDb.limit
      .mockResolvedValueOnce([]) // no fresh recs
      .mockResolvedValueOnce([{ tier: 'free' }]) // user tier
      .mockResolvedValueOnce([{ count: 1 }]) // already used today
    const caller = createCaller({ userId: 'user-1' })
    await expect(caller.aiRecs()).rejects.toThrow()
  })
})


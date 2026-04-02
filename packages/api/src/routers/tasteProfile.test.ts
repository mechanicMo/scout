// packages/api/src/routers/tasteProfile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 'tp-uuid' }]),
}))

vi.mock('@scout/db', () => ({
  db: mockDb,
  tasteProfiles: {
    id: 'id', userId: 'user_id',
    likedGenres: 'liked_genres', dislikedGenres: 'disliked_genres',
    likedThemes: 'liked_themes', favoriteActors: 'favorite_actors',
    services: 'services', notes: 'notes', lastUpdated: 'last_updated',
  },
}))

import { createCallerFactory } from '../trpc'
import { tasteProfileRouter } from './tasteProfile'

const createCaller = createCallerFactory(tasteProfileRouter)

const EMPTY_PROFILE = {
  id: 'tp-uuid', userId: 'user-1',
  likedGenres: [], dislikedGenres: [], likedThemes: [],
  favoriteActors: [], services: [], notes: '', lastUpdated: new Date(),
}

describe('tasteProfile.get', () => {
  beforeEach(() => { mockDb.limit.mockResolvedValue([]) })

  it('returns existing profile', async () => {
    mockDb.limit.mockResolvedValueOnce([EMPTY_PROFILE])
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.get()
    expect(result.userId).toBe('user-1')
  })

  it('creates profile when none exists', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.returning.mockResolvedValueOnce([EMPTY_PROFILE])
    const caller = createCaller({ userId: 'user-1' })
    await caller.get()
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.get()).rejects.toThrow()
  })
})

describe('tasteProfile.updateFromRating', () => {
  beforeEach(() => {
    mockDb.limit.mockResolvedValue([EMPTY_PROFILE])
    mockDb.returning.mockResolvedValue([{ ...EMPTY_PROFILE, likedGenres: ['Drama'] }])
  })

  it('updates likedGenres when score >= 3', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.updateFromRating({ score: 4, genres: ['Drama'] })
    expect(mockDb.update).toHaveBeenCalled()
    expect(result.likedGenres).toEqual(['Drama'])
  })

  it('updates dislikedGenres when score <= 2', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...EMPTY_PROFILE, dislikedGenres: ['Horror'] }])
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.updateFromRating({ score: 2, genres: ['Horror'] })
    expect(result.dislikedGenres).toEqual(['Horror'])
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.updateFromRating({ score: 4, genres: ['Drama'] })).rejects.toThrow()
  })
})

describe('tasteProfile.updateServices', () => {
  beforeEach(() => {
    mockDb.limit.mockResolvedValue([EMPTY_PROFILE])
    mockDb.returning.mockResolvedValue([{ ...EMPTY_PROFILE, services: ['Netflix', 'Hulu'] }])
  })

  it('saves the services array', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.updateServices({ services: ['Netflix', 'Hulu'] })
    expect(result.services).toEqual(['Netflix', 'Hulu'])
  })

  it('allows empty array', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...EMPTY_PROFILE, services: [] }])
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.updateServices({ services: [] })
    expect(result.services).toEqual([])
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.updateServices({ services: [] })).rejects.toThrow()
  })
})

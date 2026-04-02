// packages/api/src/routers/survey.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@scout/ai', () => ({
  GroqProvider: vi.fn().mockImplementation(() => ({
    generateSurveyQuestion: vi.fn().mockResolvedValue({
      question: 'What is your favorite genre?',
      options: ['Drama', 'Comedy', 'Action', 'Horror'],
    }),
  })),
}))

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  orderBy: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 'sa-1', userId: 'user-1', question: 'Q', answer: 'A', answeredAt: new Date() }]),
  delete: vi.fn().mockReturnThis(),
}))

vi.mock('@scout/db', () => ({
  db: mockDb,
  surveyAnswers: { userId: 'user_id', question: 'question', answeredAt: 'answered_at' },
  tasteProfiles: { userId: 'user_id' },
  recommendations: { userId: 'user_id', status: 'status' },
}))

import { createCallerFactory } from '../trpc'
import { surveyRouter } from './survey'

const createCaller = createCallerFactory(surveyRouter)

const EMPTY_PROFILE = {
  id: 'tp-1', userId: 'user-1',
  likedGenres: [], dislikedGenres: [], likedThemes: [],
  favoriteActors: [], services: [], notes: '', lastUpdated: new Date(),
}

describe('survey.next', () => {
  beforeEach(() => {
    mockDb.limit.mockResolvedValue([EMPTY_PROFILE])
    mockDb.orderBy.mockResolvedValue([])
  })

  it('returns first seed question when no answers exist', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.next()
    expect(result).not.toBeNull()
    expect(result?.question).toBeTruthy()
    expect(result?.options.length).toBeGreaterThan(0)
  })

  it('returns null when no profile exists', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no profile
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.next()
    expect(result).toBeNull()
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.next()).rejects.toThrow()
  })
})

describe('survey.submit', () => {
  beforeEach(() => {
    mockDb.limit.mockResolvedValue([EMPTY_PROFILE])
  })

  it('saves answer and returns it', async () => {
    const caller = createCaller({ userId: 'user-1' })
    const result = await caller.submit({ question: 'Q?', answer: 'Drama' })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(result).toHaveProperty('question')
  })

  it('throws when unauthenticated', async () => {
    const caller = createCaller({ userId: null })
    await expect(caller.submit({ question: 'Q?', answer: 'A' })).rejects.toThrow()
  })
})

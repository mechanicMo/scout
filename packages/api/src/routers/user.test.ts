import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCallerFactory } from '../trpc'
import { userRouter } from './user'

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
  users: { id: 'id', email: 'email', displayName: 'display_name' },
}))

const createCaller = createCallerFactory(userRouter)
const caller = createCaller({ userId: 'auth-uuid-123' })

describe('user.upsert', () => {
  it('inserts user row with auth UUID as id', async () => {
    const db = (await import('@scout/db')).db
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    } as any)

    const result = await caller.upsert({ email: 'test@test.com', displayName: 'Test User' })
    expect(result).toEqual({ id: 'auth-uuid-123' })
    expect(db.insert).toHaveBeenCalled()
  })
})

describe('user.me', () => {
  it('returns user when found', async () => {
    const db = (await import('@scout/db')).db
    const mockUser = { id: 'auth-uuid-123', email: 'test@test.com', displayName: 'Test', tier: 'free', createdAt: new Date() }
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    } as any)

    const result = await caller.me()
    expect(result.id).toBe('auth-uuid-123')
    expect(result.email).toBe('test@test.com')
  })

  it('throws NOT_FOUND when user does not exist', async () => {
    const db = (await import('@scout/db')).db
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any)

    await expect(caller.me()).rejects.toThrow('NOT_FOUND')
  })
})

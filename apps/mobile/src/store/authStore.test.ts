import { renderHook, act } from '@testing-library/react-native'
import { useAuthStore } from './authStore'
import { supabase } from '../lib/supabase'

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({}),
    },
  },
}))

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, user: null, loading: true })
  })

  it('sets session and user on setSession', () => {
    const { result } = renderHook(() => useAuthStore())
    const mockSession = {
      access_token: 'token',
      user: { id: 'user-123', email: 'test@test.com' },
    } as any

    act(() => result.current.setSession(mockSession))

    expect(result.current.session).toEqual(mockSession)
    expect(result.current.user?.id).toBe('user-123')
    expect(result.current.loading).toBe(false)
  })

  it('clears session on signOut', async () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.setSession({ access_token: 'token', user: { id: '1' } } as any))

    await act(() => result.current.signOut())

    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})

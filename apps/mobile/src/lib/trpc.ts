import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@scout/api'
import { useAuthStore } from '../store/authStore'

export const trpc = createTRPCReact<AppRouter>()

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: process.env.EXPO_PUBLIC_API_URL + '/trpc',
        async headers() {
          const session = useAuthStore.getState().session
          return session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}
        },
      }),
    ],
  })
}

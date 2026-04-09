import React, { useEffect, useState } from 'react'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MainNavigator } from './MainNavigator'
import { LoginScreen } from '../screens/LoginScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { trpc, createTRPCClient } from '../lib/trpc'
import colors from '../theme/colors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cache for cold start
    },
  },
})
const trpcClient = createTRPCClient()

const scoutNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background:   colors.bg,
    card:         colors.surfaceRaised,
    primary:      colors.gold,
    text:         colors.text,
    border:       colors.border,
    notification: colors.gold,
  },
}

const asyncStoragePersister = {
  persistClient: async (client: unknown) => {
    try {
      await AsyncStorage.setItem('rq-cache', JSON.stringify(client))
    } catch {}
  },
  restoreClient: async () => {
    try {
      const raw = await AsyncStorage.getItem('rq-cache')
      return raw ? JSON.parse(raw) : undefined
    } catch {
      return undefined
    }
  },
  removeClient: async () => {
    try {
      await AsyncStorage.removeItem('rq-cache')
    } catch {}
  },
}

// Inner component — lives inside trpc.Provider so can use tRPC hooks
function AppContent() {
  const { session, setSession } = useAuthStore()
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login')
  const upsertUser = trpc.user.upsert.useMutation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        upsertUser.mutate({
          email: session.user.email!,
          displayName:
            session.user.user_metadata?.display_name ??
            session.user.email!.split('@')[0],
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) {
          upsertUser.mutate({
            email: session.user.email!,
            displayName:
              session.user.user_metadata?.display_name ??
              session.user.email!.split('@')[0],
          })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <NavigationContainer theme={scoutNavTheme}>
      {session ? (
        <MainNavigator />
      ) : authScreen === 'login' ? (
        <LoginScreen onNavigateSignUp={() => setAuthScreen('signup')} />
      ) : (
        <SignUpScreen onNavigateLogin={() => setAuthScreen('login')} />
      )}
    </NavigationContainer>
  )
}

export function RootNavigator() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        <AppContent />
      </PersistQueryClientProvider>
    </trpc.Provider>
  )
}

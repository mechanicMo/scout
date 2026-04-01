import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TabNavigator } from './TabNavigator'
import { LoginScreen } from '../screens/LoginScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { trpc, createTRPCClient } from '../lib/trpc'

const queryClient = new QueryClient()
const trpcClient = createTRPCClient()

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
    <NavigationContainer>
      {session ? (
        <TabNavigator />
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
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </trpc.Provider>
  )
}

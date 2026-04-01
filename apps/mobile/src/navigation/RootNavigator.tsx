import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TabNavigator } from './TabNavigator'
import { LoginScreen } from '../screens/LoginScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { trpc, createTRPCClient } from '../lib/trpc'
import { useState } from 'react'

const queryClient = new QueryClient()

export function RootNavigator() {
  const { session, setSession } = useAuthStore()
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login')
  const trpcClient = createTRPCClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          {session ? (
            <TabNavigator />
          ) : authScreen === 'login' ? (
            <LoginScreen onNavigateSignUp={() => setAuthScreen('signup')} />
          ) : (
            <SignUpScreen onNavigateLogin={() => setAuthScreen('login')} />
          )}
        </NavigationContainer>
      </QueryClientProvider>
    </trpc.Provider>
  )
}

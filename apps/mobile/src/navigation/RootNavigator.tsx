import React, { useEffect, useState } from 'react'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert, View, Image, Text, StyleSheet } from 'react-native'
import { MainNavigator } from './MainNavigator'
import { LoginScreen } from '../screens/LoginScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import colors from '../theme/colors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cache for cold start
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const key = JSON.stringify(mutation.options.mutationKey ?? '?')
      console.log(`[MUT ERR] ${key}`, (error as any)?.message)
      Alert.alert('Something went wrong', 'Please try again.')
    },
  }),
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.log(`[QRY ERR] ${JSON.stringify(query.queryKey)}`, (error as any)?.message)
    },
  }),
})

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

function SplashScreen() {
  return (
    <View style={splashStyles.container}>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={splashStyles.icon}
        resizeMode="contain"
      />
      <Text style={splashStyles.wordmark}>SCOUT</Text>
    </View>
  )
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  icon: {
    width: 80,
    height: 80,
  },
  wordmark: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    letterSpacing: 6,
    color: colors.gold,
  },
})

// Inner component — can use React Query hooks
function AppContent() {
  const { session, loading, setSession } = useAuthStore()
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <SplashScreen />

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <AppContent />
    </PersistQueryClientProvider>
  )
}

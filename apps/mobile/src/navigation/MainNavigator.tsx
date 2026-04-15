// apps/mobile/src/navigation/MainNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TabNavigator } from './TabNavigator'
import { MediaDetailScreen } from '../screens/MediaDetailScreen'

export type RootStackParamList = {
  Main: undefined
  MediaDetail: { tmdbId: number; mediaType: 'movie' | 'tv' }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="MediaDetail"
        component={MediaDetailScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}

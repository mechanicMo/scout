import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TabNavigator } from './TabNavigator'
import { MediaDetailScreen } from '../screens/MediaDetailScreen'
import { MoodSearchScreen } from '../screens/MoodSearchScreen'

export type RootStackParamList = {
  Main: undefined
  MediaDetail: { tmdbId: number; mediaType: 'movie' | 'tv' }
  MoodSearch: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="MediaDetail"
        component={MediaDetailScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="MoodSearch"
        component={MoodSearchScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  )
}

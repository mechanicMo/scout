import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { PicksScreen } from '../screens/PicksScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { WatchlistScreen } from '../screens/WatchlistScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import colors from '../theme/colors'

const Tab = createBottomTabNavigator()

const ICONS: Record<string, string> = {
  Picks: '✦', Search: '⌕', Watchlist: '☰', Profile: '◎',
}

function icon(label: string, focused: boolean) {
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.gold : colors.textDim }}>
      {ICONS[label]}
    </Text>
  )
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 10, marginBottom: 4 },
      }}
    >
      <Tab.Screen name="Picks" component={PicksScreen} options={{ tabBarIcon: ({ focused }) => icon('Picks', focused) }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ focused }) => icon('Search', focused) }} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ tabBarIcon: ({ focused }) => icon('Watchlist', focused) }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => icon('Profile', focused) }} />
    </Tab.Navigator>
  )
}

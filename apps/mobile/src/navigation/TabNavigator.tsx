import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { PicksScreen } from '../screens/PicksScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { WatchlistScreen } from '../screens/WatchlistScreen'
import { ProfileScreen } from '../screens/ProfileScreen'

const Tab = createBottomTabNavigator()

const MARIGOLD = '#e8a020'
const DIM = '#3a2010'
const BG = '#0e0803'

function icon(label: string, focused: boolean) {
  const icons: Record<string, string> = {
    Picks: '✦', Search: '⌕', Watchlist: '☰', Profile: '◎',
  }
  return <Text style={{ fontSize: 20, color: focused ? MARIGOLD : DIM }}>{icons[label]}</Text>
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: BG, borderTopColor: '#1f1208' },
        tabBarActiveTintColor: MARIGOLD,
        tabBarInactiveTintColor: DIM,
        tabBarLabelStyle: { fontSize: 10, marginBottom: 4 },
      }}
    >
      <Tab.Screen
        name="Picks"
        component={PicksScreen}
        options={{ tabBarIcon: ({ focused }) => icon('Picks', focused) }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarIcon: ({ focused }) => icon('Search', focused) }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{ tabBarIcon: ({ focused }) => icon('Watchlist', focused) }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => icon('Profile', focused) }}
      />
    </Tab.Navigator>
  )
}

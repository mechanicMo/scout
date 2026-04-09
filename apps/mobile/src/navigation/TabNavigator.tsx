import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, StyleSheet } from 'react-native'
import { PicksScreen } from '../screens/PicksScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { WatchlistScreen } from '../screens/WatchlistScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import colors from '../theme/colors'

const Tab = createBottomTabNavigator()

const ICONS: Record<string, string> = {
  Picks: '✦', Search: '⌕', Watchlist: '☰', Profile: '◎',
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrapper}>
      {focused && <View style={styles.indicator} />}
      <Text style={[styles.icon, focused ? styles.iconFocused : styles.iconUnfocused]}>
        {ICONS[label]}
      </Text>
    </View>
  )
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Picks" component={PicksScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surfaceHigh,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 56,
    paddingBottom: 4,
    paddingTop: 8,
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    position: 'relative',
  },

  indicator: {
    position: 'absolute',
    top: -8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },

  icon: {
    fontSize: 24,
    fontWeight: '600',
  },

  iconFocused: {
    color: colors.gold,
  },

  iconUnfocused: {
    color: colors.textMuted,
  },
})

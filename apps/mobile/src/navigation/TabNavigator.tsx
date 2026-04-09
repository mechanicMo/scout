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
      {focused && <View style={styles.activeIndicator} />}
      <Text style={[styles.icon, focused ? styles.iconActive : styles.iconInactive]}>
        {ICONS[label]}
      </Text>
    </View>
  )
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="Picks"
        component={PicksScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Picks" focused={focused} /> }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Search" focused={focused} /> }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Watchlist" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0e0803',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
  },
  iconActive: {
    color: colors.gold,
  },
  iconInactive: {
    color: colors.surfaceHigh,
  },
})

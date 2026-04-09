// src/theme/spacing.ts
// 8-point grid · border radius hierarchy · platform shadows

import { Platform } from 'react-native'

// Spacing scale — all multiples of 4
export const spacing = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 64,
} as const

// Border radius hierarchy:
//   tight (4) → card (10) → modal (16) → pill (28)
export const radius = {
  tight:  4,
  sm:     6,
  md:    10,
  lg:    16,
  xl:    20,
  pill:  28,
} as const

// Platform-aware shadows — warm amber-tinted
// Usage: spread the relevant level into your StyleSheet object
export const shadows = {
  // Subtle card lift
  sm: Platform.select({
    ios: {
      shadowColor: '#e8a020',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  })!,

  // Standard card / elevated surface
  md: Platform.select({
    ios: {
      shadowColor: '#e8a020',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  })!,

  // Modals, floating elements
  lg: Platform.select({
    ios: {
      shadowColor: '#e8a020',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.20,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  })!,
}

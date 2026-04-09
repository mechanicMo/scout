// src/theme/typography.ts
// Outfit font — all weights loaded in App.tsx
// Scale follows: display → heading → title → body → caption → label

import { TextStyle } from 'react-native'

export const typography: Record<string, TextStyle> = {
  // Hero text — poster titles, splash moments
  display: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 30,
    lineHeight: 36,
    color: '#fff1e6',
    letterSpacing: -0.5,
  },

  // Screen titles, modal titles
  heading: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
    color: '#fff1e6',
  },

  // Section titles, card titles
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    color: '#fff1e6',
  },

  // Card titles (lighter weight)
  subtitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: '#fff1e6',
  },

  // Body copy, overviews
  body: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#c8a87a',
  },

  // Secondary metadata
  caption: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#7a5535',
  },

  // Uppercase section labels — "OVERVIEW", "CAST"
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#7a5535',
  },

  // Button text
  button: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  },

  // Tab bar and small chips
  micro: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    lineHeight: 13,
    color: '#7a5535',
  },
}

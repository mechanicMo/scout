// src/theme/colors.ts
// Scout color system — black/gold cinematic palette
// Core hues preserved: #100a04 (bg) · #e8a020 (gold)

const colors = {
  // Backgrounds — layered warm darks
  bg:            '#100a04',
  surface:       '#180d06',
  surfaceRaised: '#261509',   // lifted for card separation
  surfaceHigh:   '#2a1a0c',

  // Gold — primary accent
  gold:          '#e8a020',
  goldBright:    '#f0b030',
  goldDim:       '#b87c18',
  goldSubtle:    'rgba(232, 160, 32, 0.10)',
  goldBorder:    'rgba(232, 160, 32, 0.20)',

  // Text hierarchy
  text:          '#fff1e6',   // primary text — warm white
  textSoft:      '#c8a87a',   // body text
  textMuted:     '#a07848',   // secondary labels (lifted for legibility)
  textDim:       '#7a5535',   // tertiary / placeholders

  // Borders
  border:        '#3d2a14',   // lifted for defined card edges
  borderSubtle:  '#261509',

  // Status
  error:         '#e05020',
  success:       '#4a9a5a',
} as const

export type ScoutColor = keyof typeof colors
export default colors

export type MediaType = 'movie' | 'tv'

export interface MediaItem {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  year: number | null
  genres: string[]
  overview: string
  runtime: number | null
  watchProviders: WatchProviders
}

export interface WatchProviders {
  [region: string]: {
    flatrate?: Array<{ providerId: number; providerName: string; logoPath: string }>
    rent?: Array<{ providerId: number; providerName: string; logoPath: string }>
    buy?: Array<{ providerId: number; providerName: string; logoPath: string }>
  }
}

export interface TasteProfile {
  id: string
  userId: string
  likedGenres: string[]
  dislikedGenres: string[]
  likedThemes: string[]
  favoriteActors: string[]
  services: string[]
  notes: string
  lastUpdated: string
}

export interface WatchedItem {
  id: string
  userId: string
  tmdbId: number
  mediaType: MediaType
  watchedAt: string
  overallScore: number | null
  tags: string[]
}

export interface Recommendation {
  id: string
  userId: string
  tmdbId: number
  mediaType: MediaType
  generatedAt: string
  status: 'pending' | 'accepted' | 'dismissed'
  media?: MediaItem
}

export interface SurveyQuestion {
  question: string
  options: string[]
}

export interface SurveyAnswer {
  question: string
  answer: string
  answeredAt: string
}

export type Tier = 'free' | 'paid'

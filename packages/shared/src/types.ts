export type MediaType = 'movie' | 'tv'

export interface CastMember {
  name: string
  character: string
  profilePath: string | null
}

export interface MediaItem {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
  genres: string[]
  tagline: string | null
  overview: string
  runtime: number | null
  voteAverage: number | null
  director: string | null
  createdBy: string[]
  cast: CastMember[]
  contentRating: string | null
  numberOfSeasons: number | null
  numberOfEpisodes: number | null
  statusText: string | null
  network: string | null
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
  /** Rating score from 1 (worst) to 5 (best). Null if not yet rated. */
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

export interface MoodSearch {
  id: string
  title: string
  resultCount: number
  createdAt: string
}

export interface SurveyQuestion {
  question: string
  options: string[]
  multiSelect?: boolean
}

export interface SurveyAnswer {
  question: string
  answer: string
  answeredAt: string
}

export type Tier = 'free' | 'paid'

/**
 * React Query key factory for all Scout queries and mutations.
 * Follows React Query v5+ best practices with nested object structure.
 *
 * Usage:
 *   - queryKeys.watchlist.all()
 *   - queryKeys.watchlist.byStatus('saved')
 *   - queryKeys.mediaDetail.byId({ tmdbId: 550, mediaType: 'movie' })
 */

export const queryKeys = {
  // Watchlist
  watchlist: {
    all: () => ['watchlist'] as const,
    byStatus: (status: string) => [...queryKeys.watchlist.all(), status] as const,
    add: () => [...queryKeys.watchlist.all(), 'add'] as const,
    remove: () => [...queryKeys.watchlist.all(), 'remove'] as const,
    updateStatus: () => [...queryKeys.watchlist.all(), 'updateStatus'] as const,
    updateWatching: () => [...queryKeys.watchlist.all(), 'updateWatching'] as const,
  },

  // Watch History
  watchHistory: {
    all: () => ['watchHistory'] as const,
    list: () => [...queryKeys.watchHistory.all(), 'list'] as const,
    add: () => [...queryKeys.watchHistory.all(), 'add'] as const,
    remove: () => [...queryKeys.watchHistory.all(), 'remove'] as const,
  },

  // Survey
  survey: {
    all: () => ['survey'] as const,
    next: () => [...queryKeys.survey.all(), 'next'] as const,
    submit: () => [...queryKeys.survey.all(), 'submit'] as const,
  },

  // Taste Profile
  tasteProfile: {
    all: () => ['tasteProfile'] as const,
    get: () => [...queryKeys.tasteProfile.all(), 'get'] as const,
    updateFromRating: () => [...queryKeys.tasteProfile.all(), 'updateFromRating'] as const,
    updateServices: () => [...queryKeys.tasteProfile.all(), 'updateServices'] as const,
  },

  // Picks (Trending & AI Recommendations)
  picks: {
    all: () => ['picks'] as const,
    trending: () => [...queryKeys.picks.all(), 'trending'] as const,
    aiRecs: () => [...queryKeys.picks.all(), 'aiRecs'] as const,
    usage: () => [...queryKeys.picks.all(), 'usage'] as const,
  },

  // Media Details from TMDB
  mediaDetail: {
    all: () => ['mediaDetail'] as const,
    byId: (tmdbId: number, mediaType: 'movie' | 'tv') =>
      [...queryKeys.mediaDetail.all(), { tmdbId, mediaType }] as const,
  },

  // TMDB Search & Data
  tmdb: {
    all: () => ['tmdb'] as const,
    search: () => [...queryKeys.tmdb.all(), 'search'] as const,
    getMedia: (tmdbId: number, mediaType: 'movie' | 'tv') =>
      [...queryKeys.tmdb.all(), 'getMedia', { tmdbId, mediaType }] as const,
    generateTags: (tmdbId: number, mediaType: 'movie' | 'tv') =>
      [...queryKeys.tmdb.all(), 'generateTags', { tmdbId, mediaType }] as const,
  },

  // Mood Search
  moodSearch: {
    all: () => ['moodSearch'] as const,
    search: () => [...queryKeys.moodSearch.all(), 'search'] as const,
    results: () => [...queryKeys.moodSearch.all(), 'results'] as const,
    history: () => [...queryKeys.moodSearch.all(), 'history'] as const,
    refresh: () => [...queryKeys.moodSearch.all(), 'refresh'] as const,
  },

  // User
  user: {
    all: () => ['user'] as const,
    me: () => [...queryKeys.user.all(), 'me'] as const,
    upsert: () => [...queryKeys.user.all(), 'upsert'] as const,
  },
} as const;

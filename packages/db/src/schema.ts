import {
  pgSchema, pgEnum, uuid, text, timestamp, integer, jsonb, date, primaryKey, unique,
} from 'drizzle-orm/pg-core'

const scout = pgSchema('scout')

export const tierEnum = pgEnum('tier', ['free', 'paid'])
export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv'])
export const watchlistStatusEnum = pgEnum('watchlist_status', [
  'saved',
  'dismissed_not_now',
  'dismissed_never',
])
export const recStatusEnum = pgEnum('rec_status', ['pending', 'accepted', 'dismissed'])

export const users = scout.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  tier: tierEnum('tier').default('free').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const tasteProfiles = scout.table('taste_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  likedGenres: text('liked_genres').array().default([]).notNull(),
  dislikedGenres: text('disliked_genres').array().default([]).notNull(),
  likedThemes: text('liked_themes').array().default([]).notNull(),
  favoriteActors: text('favorite_actors').array().default([]).notNull(),
  services: text('services').array().default([]).notNull(),
  notes: text('notes').default('').notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
})

export const watchHistory = scout.table('watch_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tmdbId: integer('tmdb_id').notNull(),
  mediaType: mediaTypeEnum('media_type').notNull(),
  watchedAt: timestamp('watched_at').defaultNow().notNull(),
  overallScore: integer('overall_score'),
  tags: text('tags').array().default([]).notNull(),
})

export const watchlist = scout.table('watchlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tmdbId: integer('tmdb_id').notNull(),
  mediaType: mediaTypeEnum('media_type').notNull(),
  status: watchlistStatusEnum('status').default('saved').notNull(),
  resurfaceAfter: date('resurface_after'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  userMediaUnique: unique('watchlist_user_media_unique').on(table.userId, table.tmdbId, table.mediaType),
}))

export const surveyAnswers = scout.table('survey_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  answeredAt: timestamp('answered_at').defaultNow().notNull(),
})

export const recommendations = scout.table('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tmdbId: integer('tmdb_id').notNull(),
  mediaType: mediaTypeEnum('media_type').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  status: recStatusEnum('status').default('pending').notNull(),
})

export const mediaCache = scout.table(
  'media_cache',
  {
    tmdbId: integer('tmdb_id').notNull(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    year: integer('year'),
    genres: text('genres').array().default([]).notNull(),
    tagline: text('tagline'),
    overview: text('overview').default('').notNull(),
    runtime: integer('runtime'),
    voteAverage: text('vote_average'),
    director: text('director'),
    createdBy: text('created_by').array().default([]).notNull(),
    cast: jsonb('cast').default([]).notNull(),
    contentRating: text('content_rating'),
    numberOfSeasons: integer('number_of_seasons'),
    numberOfEpisodes: integer('number_of_episodes'),
    statusText: text('status_text'),
    network: text('network'),
    watchProviders: jsonb('watch_providers').default({}).notNull(),
    lastSynced: timestamp('last_synced').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tmdbId, table.mediaType] }),
  })
)

// Social bones — schema only, nothing surfaced in v1
export const follows = scout.table(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followingId] }),
  })
)

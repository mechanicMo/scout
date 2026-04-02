import { eq, and } from 'drizzle-orm'
import { db, mediaCache } from '@scout/db'
import { fetchMedia } from '@scout/shared'
import type { MediaItem, CastMember } from '@scout/shared'

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function isCacheStale(lastSynced: Date, ttlMs: number): boolean {
  return Date.now() - lastSynced.getTime() > ttlMs
}

export function cacheRowToMediaItem(hit: typeof mediaCache.$inferSelect): MediaItem {
  return {
    tmdbId: hit.tmdbId,
    mediaType: hit.mediaType,
    title: hit.title,
    posterPath: hit.posterPath ?? null,
    backdropPath: hit.backdropPath ?? null,
    year: hit.year ?? null,
    genres: hit.genres,
    tagline: hit.tagline ?? null,
    overview: hit.overview,
    runtime: hit.runtime ?? null,
    voteAverage: hit.voteAverage ?? null,
    director: hit.director ?? null,
    createdBy: hit.createdBy ?? [],
    cast: (hit.cast ?? []) as CastMember[],
    contentRating: hit.contentRating ?? null,
    numberOfSeasons: hit.numberOfSeasons ?? null,
    numberOfEpisodes: hit.numberOfEpisodes ?? null,
    statusText: hit.statusText ?? null,
    network: hit.network ?? null,
    watchProviders: (hit.watchProviders ?? {}) as MediaItem['watchProviders'],
  }
}

export async function upsertMediaCache(item: MediaItem): Promise<void> {
  await db
    .insert(mediaCache)
    .values({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      year: item.year,
      genres: item.genres,
      tagline: item.tagline,
      overview: item.overview,
      runtime: item.runtime,
      voteAverage: item.voteAverage,
      director: item.director,
      createdBy: item.createdBy,
      cast: item.cast,
      contentRating: item.contentRating,
      numberOfSeasons: item.numberOfSeasons,
      numberOfEpisodes: item.numberOfEpisodes,
      statusText: item.statusText,
      network: item.network,
      watchProviders: item.watchProviders,
      lastSynced: new Date(),
    })
    .onConflictDoUpdate({
      target: [mediaCache.tmdbId, mediaCache.mediaType],
      set: {
        title: item.title,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        year: item.year,
        genres: item.genres,
        tagline: item.tagline,
        overview: item.overview,
        runtime: item.runtime,
        voteAverage: item.voteAverage,
        director: item.director,
        createdBy: item.createdBy,
        cast: item.cast,
        contentRating: item.contentRating,
        numberOfSeasons: item.numberOfSeasons,
        numberOfEpisodes: item.numberOfEpisodes,
        statusText: item.statusText,
        network: item.network,
        watchProviders: item.watchProviders,
        lastSynced: new Date(),
      },
    })
}

/**
 * Get a MediaItem — from cache if fresh, from TMDB API otherwise.
 * Returns null if TMDB fetch fails (bad tmdbId, network error).
 */
export async function getOrFetchMedia(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  tmdbToken: string
): Promise<MediaItem | null> {
  const cached = await db
    .select()
    .from(mediaCache)
    .where(and(eq(mediaCache.tmdbId, tmdbId), eq(mediaCache.mediaType, mediaType)))
    .limit(1)

  const hit = cached[0]
  if (hit && !isCacheStale(hit.lastSynced, CACHE_TTL_MS)) {
    return cacheRowToMediaItem(hit)
  }

  try {
    const fresh = await fetchMedia(tmdbId, mediaType, tmdbToken)
    await upsertMediaCache(fresh)
    return fresh
  } catch {
    return null
  }
}

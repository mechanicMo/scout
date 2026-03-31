import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMedia, buildPosterUrl } from './tmdb'

describe('buildPosterUrl', () => {
  it('returns full URL for a poster path', () => {
    const url = buildPosterUrl('/abc123.jpg')
    expect(url).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg')
  })

  it('returns null for null poster path', () => {
    expect(buildPosterUrl(null)).toBeNull()
  })
})

describe('fetchMedia', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches movie details from TMDB', async () => {
    const mockMovie = {
      id: 550,
      title: 'Fight Club',
      release_date: '1999-10-15',
      overview: 'An insomniac...',
      runtime: 139,
      genres: [{ id: 18, name: 'Drama' }],
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMovie,
    } as Response)

    const result = await fetchMedia(550, 'movie', 'test-token')
    expect(result.tmdbId).toBe(550)
    expect(result.title).toBe('Fight Club')
    expect(result.year).toBe(1999)
    expect(result.genres).toEqual(['Drama'])
    expect(result.runtime).toBe(139)
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(fetchMedia(999999, 'movie', 'test-token')).rejects.toThrow('TMDB fetch failed: 404')
  })
})

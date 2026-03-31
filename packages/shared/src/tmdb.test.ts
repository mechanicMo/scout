import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMedia, buildPosterUrl, searchTMDB } from './tmdb'

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

  it('fetches TV show details using name and first_air_date fields', async () => {
    const mockShow = {
      id: 67070,
      name: 'Severance',
      first_air_date: '2022-02-18',
      overview: 'Employees agree to a procedure...',
      episode_run_time: [45],
      genres: [{ id: 18, name: 'Drama' }],
      poster_path: '/abc.jpg',
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockShow,
    } as Response)

    const result = await fetchMedia(67070, 'tv', 'test-token')
    expect(result.tmdbId).toBe(67070)
    expect(result.title).toBe('Severance')
    expect(result.year).toBe(2022)
    expect(result.runtime).toBe(45)
    expect(result.genres).toEqual(['Drama'])
  })
})

describe('searchTMDB', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns movie and TV results, filtering out non-media types', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 1, media_type: 'movie', title: 'Inception', release_date: '2010-07-16', poster_path: null, overview: 'A thief...' },
          { id: 2, media_type: 'tv', name: 'Breaking Bad', first_air_date: '2008-01-20', poster_path: null, overview: 'A teacher...' },
          { id: 3, media_type: 'person', name: 'Christopher Nolan' }, // should be filtered out
        ],
      }),
    } as Response)

    const results = await searchTMDB('test', 'test-token')
    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('Inception')
    expect(results[0].year).toBe(2010)
    expect(results[1].title).toBe('Breaking Bad')
    expect(results[1].year).toBe(2008)
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    await expect(searchTMDB('test', 'bad-token')).rejects.toThrow('TMDB search failed: 401')
  })
})

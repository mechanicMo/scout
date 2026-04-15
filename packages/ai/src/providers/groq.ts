import type { AIProvider, Interaction, SearchFilters } from '../types'
import type { TasteProfile, WatchedItem, Recommendation, SurveyQuestion, SurveyAnswer, MediaItem } from '@scout/shared'

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

interface GroqMessage { role: 'system' | 'user' | 'assistant'; content: string }
interface GroqResponse { choices: Array<{ message: { content: string } }> }

export class GroqProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  private async chat(messages: GroqMessage[], maxTokens = 800): Promise<string> {
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: maxTokens }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Groq API error ${res.status}: ${body}`)
    }
    const data = await res.json() as GroqResponse
    return data.choices[0]?.message?.content ?? ''
  }

  private parseJSON<T>(text: string): T | null {
    const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
    try { return JSON.parse(cleaned) as T } catch { /* try extracting */ }
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    const match = arrayMatch?.[0] ?? objMatch?.[0]
    if (!match) return null
    try { return JSON.parse(match) as T } catch { return null }
  }

  async generateRecommendations(
    profile: TasteProfile,
    recentHistory: WatchedItem[]
  ): Promise<Recommendation[]> {
    const profileLines = [
      profile.likedGenres.length > 0 ? `Liked genres: ${profile.likedGenres.join(', ')}` : null,
      profile.dislikedGenres.length > 0 ? `Disliked genres: ${profile.dislikedGenres.join(', ')}` : null,
      profile.likedThemes.length > 0 ? `Liked themes: ${profile.likedThemes.join(', ')}` : null,
      profile.favoriteActors.length > 0 ? `Favorite actors: ${profile.favoriteActors.join(', ')}` : null,
      profile.services.length > 0 ? `Streaming services: ${profile.services.join(', ')} — prioritize titles available on these` : null,
      profile.notes ? `Notes: ${profile.notes}` : null,
    ].filter(Boolean).join('\n')

    const historyLines = recentHistory.slice(0, 20).map(h =>
      `- TMDB ${h.tmdbId} (${h.mediaType})${h.overallScore != null ? `, rated ${h.overallScore}/5` : ''}`
    ).join('\n')

    const content = await this.chat([
      {
        role: 'system',
        content: 'You are Scout, a movie and TV recommendation engine with deep knowledge of TMDB IDs. Respond ONLY with valid JSON, no explanation.',
      },
      {
        role: 'user',
        content: `Recommend exactly 10 movies or TV shows for this user.

Taste profile:
${profileLines || '(No taste data — recommend popular critically-acclaimed titles)'}

Recent watch history:
${historyLines || '(No history yet)'}

JSON array only. Each item: {"tmdbId": number, "mediaType": "movie" or "tv"}
Example: [{"tmdbId": 278, "mediaType": "movie"}, {"tmdbId": 1396, "mediaType": "tv"}]`,
      },
    ])

    const parsed = this.parseJSON<Array<{ tmdbId: number; mediaType: string }>>(content)
    if (!Array.isArray(parsed)) return []
    const now = new Date().toISOString()
    return parsed
      .filter(r => typeof r.tmdbId === 'number' && (r.mediaType === 'movie' || r.mediaType === 'tv'))
      .slice(0, 10)
      .map(r => ({
        id: '',
        userId: profile.userId,
        tmdbId: r.tmdbId,
        mediaType: r.mediaType as 'movie' | 'tv',
        generatedAt: now,
        status: 'pending' as const,
      }))
  }

  async refineRecommendations(
    message: string,
    current: Recommendation[],
    profile: TasteProfile,
    discoverPool?: Array<{ tmdbId: number; mediaType: string; title: string; year: number | null; genres: string[]; overview: string }>
  ): Promise<Recommendation[]> {
    const currentList = current.map(r =>
      r.media ? `- ${r.media.title} (${r.mediaType}, TMDB ${r.tmdbId})` : `- TMDB ${r.tmdbId} (${r.mediaType})`
    ).join('\n')

    // Build the pool section - these are real, verified TMDB titles
    const poolSection = discoverPool && discoverPool.length > 0
      ? `\nAvailable titles from search (USE THESE - they are verified TMDB entries):\n${discoverPool.map(p =>
          `- "${p.title}" (${p.year ?? '?'}, ${p.mediaType}, TMDB ${p.tmdbId}) — ${p.genres.join(', ')}${p.overview ? ` — ${p.overview.slice(0, 100)}` : ''}`
        ).join('\n')}`
      : ''

    const content = await this.chat([
      {
        role: 'system',
        content: 'You are Scout, a movie and TV recommendation engine. Respond ONLY with valid JSON.',
      },
      {
        role: 'user',
        content: `Refine this user's movie/TV picks.

Current recommendations:
${currentList || '(none)'}

User says: "${message}"

Profile notes: ${profile.notes || '(none)'}
${poolSection}

Return exactly 10 recommendations. STRONGLY PREFER titles from the "Available titles" list above — they are verified to exist. Only use titles outside the list if the list doesn't have enough good matches.

JSON array only.
Each item: {"tmdbId": number, "mediaType": "movie" or "tv"}`,
      },
    ])

    const parsed = this.parseJSON<Array<{ tmdbId: number; mediaType: string }>>(content)
    if (!Array.isArray(parsed)) return []
    const now = new Date().toISOString()
    return parsed
      .filter(r => typeof r.tmdbId === 'number' && (r.mediaType === 'movie' || r.mediaType === 'tv'))
      .slice(0, 10)
      .map(r => ({
        id: '',
        userId: profile.userId,
        tmdbId: r.tmdbId,
        mediaType: r.mediaType as 'movie' | 'tv',
        generatedAt: now,
        status: 'pending' as const,
      }))
  }

  async extractSearchFilters(message: string): Promise<SearchFilters> {
    const currentYear = new Date().getFullYear()
    const content = await this.chat([
      {
        role: 'system',
        content: `You extract structured search filters from natural language movie/TV requests. Current year is ${currentYear}. Respond ONLY with valid JSON.`,
      },
      {
        role: 'user',
        content: `Extract search filters from this request: "${message}"

Return JSON:
{
  "mediaType": "movie" or "tv" or "any",
  "genres": ["genre1", "genre2"],
  "yearMin": number or null,
  "yearMax": number or null,
  "mood": "one word mood" or null,
  "keywords": ["keyword1"] or []
}

Genre names should be lowercase TMDB genres: action, adventure, animation, comedy, crime, documentary, drama, family, fantasy, history, horror, music, mystery, romance, science fiction, thriller, war, western.

For year references: "recent" = ${currentYear - 1}-${currentYear}, "classic" = pre-1980, "90s" = 1990-1999, "2000s" = 2000-2009.
For mood: map "lighthearted" to comedy/family genres AND mood, "dark" to thriller/drama, "scary" to horror, etc.`,
      },
    ], 300)

    const parsed = this.parseJSON<SearchFilters>(content)
    if (!parsed) return { mediaType: 'any', genres: [], keywords: [] }
    return {
      mediaType: parsed.mediaType ?? 'any',
      genres: Array.isArray(parsed.genres) ? parsed.genres : [],
      yearMin: typeof parsed.yearMin === 'number' ? parsed.yearMin : undefined,
      yearMax: typeof parsed.yearMax === 'number' ? parsed.yearMax : undefined,
      mood: typeof parsed.mood === 'string' ? parsed.mood : undefined,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    }
  }

  async generateSurveyQuestion(
    profile: TasteProfile,
    answered: SurveyAnswer[]
  ): Promise<SurveyQuestion | null> {
    const answeredText = answered.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
    const profileLines = [
      profile.likedGenres.length > 0 ? `Liked genres: ${profile.likedGenres.join(', ')}` : null,
      profile.notes ? `Notes: ${profile.notes}` : null,
    ].filter(Boolean).join('\n')

    const content = await this.chat([
      {
        role: 'system',
        content: "You are Scout, building a movie/TV taste profile. Generate ONE question to fill a gap. Respond ONLY with valid JSON.",
      },
      {
        role: 'user',
        content: `Profile so far:
${profileLines || '(empty)'}

Already answered:
${answeredText || '(none)'}

Generate ONE question with exactly 4 options.
JSON only: {"question": "...", "options": ["...", "...", "...", "..."]}`,
      },
    ], 300)

    const parsed = this.parseJSON<{ question: string; options: string[] }>(content)
    if (!parsed || typeof parsed.question !== 'string' || !Array.isArray(parsed.options)) return null
    return { question: parsed.question, options: parsed.options.slice(0, 4) }
  }

  // v1: structured updates handled by tasteProfile router.
  // AI-maintained notes is a paid-tier feature — not in v1.
  async updateTasteProfile(profile: TasteProfile, _interaction: Interaction): Promise<TasteProfile> {
    return profile
  }

  async generateTags(media: MediaItem, profile: TasteProfile): Promise<string[]> {
    const tasteLine = [
      ...(profile.likedThemes.length > 0 ? profile.likedThemes : profile.likedGenres),
    ].slice(0, 4).join(', ')

    const content = await this.chat([
      {
        role: 'system',
        content: 'You are Scout. Generate 6-8 short tag phrases (2-4 words each) for this title. Focus on themes, tone, mood, and memorable qualities — not just genres. Respond ONLY with a JSON array of strings.',
      },
      {
        role: 'user',
        content: `Title: ${media.title}
Genres: ${media.genres.join(', ')}
Overview: ${media.overview.slice(0, 300)}
User likes: ${tasteLine || 'unknown'}

JSON array only: ["tag1", "tag2", ...]`,
      },
    ], 200)

    const parsed = this.parseJSON<string[]>(content)
    if (!Array.isArray(parsed)) return media.genres.slice(0, 6)
    return parsed.filter((t): t is string => typeof t === 'string').slice(0, 8)
  }
}

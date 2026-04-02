import type { AIProvider, Interaction } from '../types'
import type { TasteProfile, WatchedItem, Recommendation, SurveyQuestion, SurveyAnswer } from '@scout/shared'

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
    profile: TasteProfile
  ): Promise<Recommendation[]> {
    const currentList = current.map(r =>
      r.media ? `- ${r.media.title} (${r.mediaType}, TMDB ${r.tmdbId})` : `- TMDB ${r.tmdbId} (${r.mediaType})`
    ).join('\n')

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

Return exactly 10 recommendations. JSON array only.
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
}

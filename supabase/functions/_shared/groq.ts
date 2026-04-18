// supabase/functions/_shared/groq.ts
// Minimal Groq client. Ported from packages/ai/src/groq-provider.ts for Deno.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

export function getGroqKey(): string {
  const k = Deno.env.get('GROQ_API_KEY')
  if (!k) throw new Error('GROQ_API_KEY is required')
  return k
}

async function complete(prompt: string, systemPrompt: string, temperature = 0.7): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getGroqKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`Groq failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

export type TasteProfile = {
  likedGenres: string[]; dislikedGenres: string[]; likedThemes: string[]
  favoriteActors: string[]; services: string[]; notes: string
}

export type WatchedItem = {
  tmdbId: number; mediaType: 'movie' | 'tv'
  overallScore: number | null; tags: string[]
}

export type Recommendation = { tmdbId: number; mediaType: 'movie' | 'tv' }

export type SurveyAnswer = { question: string; answer: string }

export type SurveyQuestion = {
  question: string; options: string[]; multiSelect?: boolean
}

export async function generateRecommendations(
  profile: TasteProfile, history: WatchedItem[],
): Promise<Recommendation[]> {
  const sys = 'You are a media recommendation engine. Return JSON { "recommendations": [{ "tmdbId": number, "mediaType": "movie"|"tv" }] }. Recommend 10-15 titles.'
  const user = `Taste profile: ${JSON.stringify(profile)}\nRecent watch history: ${JSON.stringify(history.slice(0, 20))}\nRecommend 10-15 titles this user would enjoy. Prioritize what's available on their services: ${profile.services.join(', ') || 'any'}. Return valid TMDB IDs only.`
  const raw = await complete(user, sys)
  const parsed = JSON.parse(raw)
  return parsed.recommendations ?? []
}

export async function generateSurveyQuestion(
  profile: TasteProfile, answered: SurveyAnswer[],
): Promise<SurveyQuestion> {
  const sys = 'You are refining a user\'s media taste profile. Return JSON { "question": string, "options": string[4], "multiSelect"?: boolean }. Ask a concise open-ended question that will help recommend better. Each option should be a short phrase (2-6 words).'
  const user = `Current taste profile: ${JSON.stringify(profile)}\nAlready answered: ${JSON.stringify(answered)}\nAsk one new question that would meaningfully refine this profile.`
  const raw = await complete(user, sys)
  return JSON.parse(raw)
}

export type MoodIntent = {
  genres: string[]           // TMDB genre names (e.g. "Science Fiction", "Drama")
  yearMin: number | null     // e.g. 1980 for "80s films"
  yearMax: number | null     // e.g. 1989 for "80s films"
  mediaType: 'movie' | 'tv' | 'both'
  keywords: string[]         // tone/theme descriptors TMDB can't express (e.g. "cozy", "dark humor")
}

/**
 * Extracts structured TMDB query parameters from a freeform mood/vibe description.
 * Uses low temperature for consistent, deterministic output.
 */
export async function extractMoodIntent(mood: string): Promise<MoodIntent> {
  const sys = `Extract structured search parameters from a mood/vibe description. Return JSON:
{
  "genres": string[],      // genre names from this list only: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, Thriller, War, Western
  "yearMin": number|null,  // earliest year if a decade or era is mentioned, else null
  "yearMax": number|null,  // latest year if a decade or era is mentioned, else null
  "mediaType": "movie"|"tv"|"both",  // infer from words like "show", "series", "binge" (tv), "film", "movie" (movie), or "both" if unclear
  "keywords": string[]     // 1-3 tone/mood descriptors not captured by genre, e.g. "cozy", "nostalgic", "slow-burn"
}`
  const user = `Mood: ${mood}`
  const raw = await complete(user, sys, 0.1)
  const parsed = JSON.parse(raw)
  return {
    genres: Array.isArray(parsed.genres) ? parsed.genres : [],
    yearMin: typeof parsed.yearMin === 'number' ? parsed.yearMin : null,
    yearMax: typeof parsed.yearMax === 'number' ? parsed.yearMax : null,
    mediaType: ['movie', 'tv', 'both'].includes(parsed.mediaType) ? parsed.mediaType : 'both',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
  }
}

export async function rankTitlesByMood(
  mood: string,
  candidates: Array<{ tmdbId: number; title: string; overview: string }>,
  keywords: string[] = [],
): Promise<number[]> {
  const keywordCtx = keywords.length > 0 ? `\nTone to prioritize: ${keywords.join(', ')}` : ''
  const sys = 'You rank titles by how well they match a mood description. Return JSON { "ranked": number[] } — array of tmdbIds in best-to-worst order. Include only titles that genuinely match the mood.'
  const user = `Mood: ${mood}${keywordCtx}\nCandidates: ${JSON.stringify(candidates.slice(0, 60))}\nRank and filter to best matches only.`
  const raw = await complete(user, sys)
  const parsed = JSON.parse(raw)
  return parsed.ranked ?? []
}

export async function generateTags(
  tmdbId: number, title: string, overview: string, genres: string[],
): Promise<string[]> {
  const sys = 'Return JSON { "tags": string[5-8] } — evocative one-to-two word tags describing tone, mood, style, or themes. Not plot summaries.'
  const user = `Title: ${title}\nGenres: ${genres.join(', ')}\nOverview: ${overview}`
  const raw = await complete(user, sys)
  const parsed = JSON.parse(raw)
  return parsed.tags ?? []
}

export async function summarizeMoodQuery(query: string): Promise<string> {
  const sys = 'Return JSON { "title": string } — a 3-8 word summary of the user\'s mood/vibe query, title-cased.'
  const user = `Query: ${query}`
  const raw = await complete(user, sys)
  const parsed = JSON.parse(raw)
  return parsed.title ?? query.slice(0, 40)
}

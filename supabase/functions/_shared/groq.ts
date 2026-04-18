// supabase/functions/_shared/groq.ts
// Minimal Groq client. Ported from packages/ai/src/groq-provider.ts for Deno.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

export function getGroqKey(): string {
  const k = Deno.env.get('GROQ_API_KEY')
  if (!k) throw new Error('GROQ_API_KEY is required')
  return k
}

async function complete(prompt: string, systemPrompt: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getGroqKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
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

export async function rankTitlesByMood(
  mood: string, candidates: Array<{ tmdbId: number; title: string; overview: string }>,
): Promise<number[]> {
  const sys = 'You rank titles by how well they match a mood description. Return JSON { "ranked": number[] } — array of tmdbIds in best-to-worst order. Include only titles that match the mood well.'
  const user = `Mood: ${mood}\nCandidates: ${JSON.stringify(candidates.slice(0, 30))}\nRank and filter to best matches.`
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

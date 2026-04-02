// packages/api/src/routers/survey.ts
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { db, surveyAnswers, tasteProfiles, recommendations } from '@scout/db'
import { GroqProvider } from '@scout/ai'
import type { TasteProfile, SurveyQuestion, SurveyAnswer } from '@scout/shared'

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is required')
  return key
}

// Shown to new users before AI-generated questions kick in
const SEED_QUESTIONS: SurveyQuestion[] = [
  {
    question: "What genre do you reach for when you're not sure what to watch?",
    options: ['Action / Thriller', 'Drama', 'Comedy', 'Horror / Sci-Fi'],
  },
  {
    question: 'Do you prefer movies or TV shows?',
    options: ['Mostly movies', 'Mostly TV', 'Equal mix', "Depends on my mood"],
  },
  {
    question: 'How do you feel about foreign language films?',
    options: ['Love them', 'Fine with subtitles sometimes', 'Prefer English', "Depends on the film"],
  },
  {
    question: 'What kind of pacing do you prefer?',
    options: ['Fast and intense', 'Slow burn', 'Mix of both', 'Depends on the story'],
  },
]

export const surveyRouter = router({
  next: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId

      // Require a taste profile to exist
      const profileRows = await db.select().from(tasteProfiles).where(eq(tasteProfiles.userId, userId)).limit(1)
      const profile = profileRows[0] ?? null
      if (!profile) return null

      // Fetch all answered questions
      const answered = await db
        .select()
        .from(surveyAnswers)
        .where(eq(surveyAnswers.userId, userId))
        .orderBy(desc(surveyAnswers.answeredAt))

      const answeredQuestions = new Set(answered.map(a => a.question))

      // Return first unanswered seed question
      for (const seed of SEED_QUESTIONS) {
        if (!answeredQuestions.has(seed.question)) {
          return seed
        }
      }

      // All seeds answered — generate AI question
      const tasteProfileInput: TasteProfile = {
        id: profile.id,
        userId: profile.userId,
        likedGenres: profile.likedGenres ?? [],
        dislikedGenres: profile.dislikedGenres ?? [],
        likedThemes: profile.likedThemes ?? [],
        favoriteActors: profile.favoriteActors ?? [],
        services: profile.services ?? [],
        notes: profile.notes ?? '',
        lastUpdated: profile.lastUpdated.toISOString(),
      }

      const surveyAnswerInputs: SurveyAnswer[] = answered.map(a => ({
        question: a.question,
        answer: a.answer,
        answeredAt: a.answeredAt.toISOString(),
      }))

      const groq = new GroqProvider(getGroqKey())
      return groq.generateSurveyQuestion(tasteProfileInput, surveyAnswerInputs)
    }),

  submit: protectedProcedure
    .input(z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId

      const [saved] = await db
        .insert(surveyAnswers)
        .values({ userId, question: input.question, answer: input.answer })
        .returning()
      if (!saved) throw new Error('Failed to save survey answer')

      // Invalidate AI recs so feed refreshes with new answer incorporated
      await db.delete(recommendations).where(
        and(eq(recommendations.userId, userId), eq(recommendations.status, 'pending'))
      )

      return saved
    }),
})

export type SurveyRouter = typeof surveyRouter

// deno-lint-ignore-file no-explicit-any

import { requireUserId, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { generateSurveyQuestion, type SurveyQuestion, type TasteProfile, type SurveyAnswer } from '../_shared/groq.ts'
import { checkDailyLimit, logUsage, TooManyRequestsError } from '../_shared/rate-limit.ts'
import { SEED_QUESTIONS } from './seeds.ts'

interface SurveyQuestionRow {
  id: string
  question: string
  options: string[]
  multi_select: boolean
  source: 'seed' | 'ai'
  skip_count: number
  queue_order: bigint
  consumed_at: string | null
}

interface UserPreferenceRow {
  id: string
  user_id: string
  taste_profile: TasteProfile | null
  answered_survey_questions: SurveyAnswer[]
}

/**
 * Populate seed questions for user if not already present.
 * Marks questions as consumed if the user has already answered them.
 */
async function ensureSeeds(supabase: any, userId: string): Promise<void> {
  // Get max queue_order for this user
  const { data: maxRow } = await supabase
    .from('survey_question_state')
    .select('queue_order')
    .eq('user_id', userId)
    .order('queue_order', { ascending: false })
    .limit(1)

  let nextQueueOrder = 0
  if (maxRow && maxRow.length > 0) {
    nextQueueOrder = Number((maxRow[0] as any).queue_order) + 1
  }

  // Get user's existing answers from preferences table
  const { data: prefRow } = await supabase
    .from('user_preferences')
    .select('answered_survey_questions')
    .eq('user_id', userId)
    .single()

  const answeredQuestions = new Set(
    (prefRow as any)?.answered_survey_questions?.map((a: any) => a.question) ?? []
  )

  // Get already inserted seed questions
  const { data: existingSeeds } = await supabase
    .from('survey_question_state')
    .select('question')
    .eq('user_id', userId)
    .eq('source', 'seed')

  const existingQuestions = new Set(
    (existingSeeds ?? []).map((row: any) => row.question)
  )

  // Insert missing seed questions
  const toInsert: any[] = []
  for (const seed of SEED_QUESTIONS) {
    if (!existingQuestions.has(seed.question)) {
      const consumedAt = answeredQuestions.has(seed.question) ? new Date().toISOString() : null
      toInsert.push({
        user_id: userId,
        question: seed.question,
        options: seed.options,
        multi_select: seed.multiSelect,
        source: 'seed',
        skip_count: 0,
        queue_order: nextQueueOrder,
        consumed_at: consumedAt,
      })
      nextQueueOrder += 1
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('survey_question_state').insert(toInsert)
  }
}

/**
 * Get the next unconsumed survey question for the user.
 * Returns the question with lowest queue_order where skip_count < 2 and consumed_at is null.
 */
async function getNextQuestion(supabase: any, userId: string): Promise<SurveyQuestionRow | null> {
  const { data } = await supabase
    .from('survey_question_state')
    .select('*')
    .eq('user_id', userId)
    .lt('skip_count', 2)
    .is('consumed_at', null)
    .order('queue_order', { ascending: true })
    .limit(1)

  return (data?.length ?? 0) > 0 ? (data![0] as SurveyQuestionRow) : null
}

/**
 * Generate an AI survey question and insert it into the queue.
 */
async function generateAndInsertAiQuestion(
  supabase: any,
  userId: string,
): Promise<SurveyQuestionRow> {
  // Get user's taste profile and answered questions
  const { data: prefRow } = await supabase
    .from('user_preferences')
    .select('taste_profile, answered_survey_questions')
    .eq('user_id', userId)
    .single()

  const profile: TasteProfile = (prefRow as any)?.taste_profile ?? {
    likedGenres: [],
    dislikedGenres: [],
    likedThemes: [],
    favoriteActors: [],
    services: [],
    notes: '',
  }

  const answered: SurveyAnswer[] = (prefRow as any)?.answered_survey_questions ?? []

  // Generate question via Groq
  const generated = await generateSurveyQuestion(profile, answered)

  // Get max queue_order for this user
  const { data: maxRow } = await supabase
    .from('survey_question_state')
    .select('queue_order')
    .eq('user_id', userId)
    .order('queue_order', { ascending: false })
    .limit(1)

  const queueOrder = (maxRow?.length ?? 0) > 0 ? Number((maxRow![0] as any).queue_order) + 1 : 0

  // Insert the generated question
  const { data: inserted } = await supabase
    .from('survey_question_state')
    .insert({
      user_id: userId,
      question: generated.question,
      options: generated.options,
      multi_select: generated.multiSelect ?? false,
      source: 'ai',
      skip_count: 0,
      queue_order: queueOrder,
      consumed_at: null,
    })
    .select()
    .single()

  return inserted as SurveyQuestionRow
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Require authentication
    const userId = await requireUserId(req)
    const supabase = serviceClient()

    // Ensure seed questions are populated
    await ensureSeeds(supabase, userId)

    // Query for next unconsumed question
    let question = await getNextQuestion(supabase, userId)

    if (question) {
      return jsonResponse(question)
    }

    // Queue is empty, check daily limit for AI questions
    try {
      await checkDailyLimit(supabase, userId, 'ai_survey_question', 2, 2)
    } catch (err) {
      if (err instanceof TooManyRequestsError) {
        // Daily limit reached, return null (no question available)
        return jsonResponse({ question: null })
      }
      throw err
    }

    // Generate and insert AI question
    question = await generateAndInsertAiQuestion(supabase, userId)

    // Log usage
    await logUsage(supabase, userId, 'ai_survey_question')

    return jsonResponse(question)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : 500
    return errorResponse(message, status)
  }
}

// For Supabase deployment
export default handler

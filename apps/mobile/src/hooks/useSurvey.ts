import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

const SEEDS = [
  { question: 'What genres do you reach for when you want to relax?', options: ['Comedy & lighthearted', 'Drama & emotional', 'Sci-fi & fantasy', 'Thriller & suspense'], multiSelect: true },
  { question: 'Do you prefer movies or TV shows?', options: ['Movies - prefer completing a story in one sitting', 'TV shows - love ongoing narratives', 'No preference', 'Depends on my mood'], multiSelect: false },
  { question: 'How do you feel about foreign films and shows with subtitles?', options: ['Love them, bring the subtitles on', 'Prefer dubbed versions', 'Depends on the quality of the story', 'Rarely watch them'], multiSelect: false },
  { question: 'What kind of pacing do you prefer?', options: ['Fast-paced action and excitement', 'Slow-burn with deep character development', 'Mixed, depends on the story', 'Fast at start then slower'], multiSelect: false },
  { question: 'How much time are you willing to invest in a show before deciding to drop it?', options: ['One episode - hook me immediately', '2-3 episodes', 'First season', 'Depends on the premise and cast'], multiSelect: true },
]

export function useSurveyQuestion() {
  return useQuery({
    queryKey: queryKeys.survey.next(),
    queryFn: async () => {
      // Try to get next unconsumed question directly from DB (bypasses edge function BigInt issues)
      const { data: questions } = await supabase
        .from('survey_question_state')
        .select('id, question, options, multi_select')
        .lt('skip_count', 2)
        .is('consumed_at', null)
        .order('queue_order', { ascending: true })
        .limit(1)

      if (questions && questions.length > 0) {
        return questions[0] as { id: string; question: string; options: string[]; multi_select: boolean }
      }

      // No questions — seed for this user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: existing } = await supabase
        .from('survey_question_state')
        .select('question')
        .eq('user_id', user.id)
        .eq('source', 'seed')

      const existingSet = new Set((existing ?? []).map((r: any) => r.question))
      const baseOrder = existing?.length ?? 0

      const toInsert = SEEDS
        .filter(s => !existingSet.has(s.question))
        .map((s, i) => ({
          user_id: user.id,
          question: s.question,
          options: s.options,
          multi_select: s.multiSelect,
          source: 'seed',
          skip_count: 0,
          queue_order: baseOrder + i,
        }))

      if (toInsert.length > 0) {
        await supabase.from('survey_question_state').insert(toInsert)
      } else if ((existing?.length ?? 0) >= SEEDS.length) {
        // All seeds consumed — cycle back to the beginning
        await supabase
          .from('survey_question_state')
          .update({ consumed_at: null, skip_count: 0 })
          .eq('user_id', user.id)
          .eq('source', 'seed')
      }

      const { data: seeded } = await supabase
        .from('survey_question_state')
        .select('id, question, options, multi_select')
        .eq('user_id', user.id)
        .lt('skip_count', 2)
        .is('consumed_at', null)
        .order('queue_order', { ascending: true })
        .limit(1)

      return seeded?.[0] ?? null
    },
    staleTime: 0,
  })
}

/**
 * Mutation to submit a survey answer with optimistic UI.
 * Stores the answer and marks the question as answered.
 */
export function useAnswerSurvey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      questionId,
      question,
      answer,
    }: {
      questionId: string
      question: string
      answer: string | string[] // Can be single answer or multiple for multi-select
    }) => {
      const answerText = Array.isArray(answer) ? answer.join(',') : answer

      const { data, error } = await supabase
        .from('survey_answers')
        .insert({
          question: question,
          answer: answerText,
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to submit survey answer: ${error.message}`)

      // Invalidate the next question query to fetch the next one
      await queryClient.invalidateQueries({ queryKey: queryKeys.survey.next() })

      return data
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.survey.next() })

      const previousData = queryClient.getQueryData(queryKeys.survey.next())

      // Optimistically mark as answered (we'll get the next question on refetch)
      queryClient.setQueryData(queryKeys.survey.next(), undefined)

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.survey.next(), context.previousData)
      }
    },
  })
}

/**
 * Mutation to skip a survey question with optimistic UI.
 * Records the skip action and fetches the next question.
 */
export function useSkipQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ questionId, question }: { questionId: string; question: string }) => {
      // Log the skip action as a special survey answer
      const { data, error } = await supabase
        .from('survey_answers')
        .insert({
          question: question,
          answer: 'SKIPPED',
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to skip question: ${error.message}`)

      // Invalidate the next question query to fetch the next one
      await queryClient.invalidateQueries({ queryKey: queryKeys.survey.next() })

      return data
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.survey.next() })

      const previousData = queryClient.getQueryData(queryKeys.survey.next())

      // Optimistically clear the current question
      queryClient.setQueryData(queryKeys.survey.next(), undefined)

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.survey.next(), context.previousData)
      }
    },
  })
}

export const useNextSurvey = useSurveyQuestion

export function useSubmitSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, question: _question, answer: _answer }: { id: string; question: string; answer: string | string[] }) => {
      const { error } = await supabase
        .from('survey_question_state')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`Failed to consume survey question: ${error.message}`)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.survey.next() })
      const prev = queryClient.getQueryData(queryKeys.survey.next())
      queryClient.setQueryData(queryKeys.survey.next(), null)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(queryKeys.survey.next(), ctx?.prev ?? null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.survey.next() })
    },
  })
}

export function useSkipSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: row, error: fetchError } = await supabase
        .from('survey_question_state')
        .select('skip_count')
        .eq('id', id)
        .single()
      if (fetchError) throw new Error(`Failed to fetch question: ${fetchError.message}`)
      const newCount = ((row as any)?.skip_count ?? 0) + 1
      const { error } = await supabase
        .from('survey_question_state')
        .update({ skip_count: newCount })
        .eq('id', id)
      if (error) throw new Error(`Failed to skip survey question: ${error.message}`)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.survey.next() })
      const prev = queryClient.getQueryData(queryKeys.survey.next())
      queryClient.setQueryData(queryKeys.survey.next(), null)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(queryKeys.survey.next(), ctx?.prev ?? null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.survey.next() })
    },
  })
}

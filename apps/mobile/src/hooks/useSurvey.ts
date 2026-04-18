import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { surveyNext } from '../lib/scoutApi'
import type { SurveyQuestion, SurveyNextResponse } from '../lib/scoutApi'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../queries/keys'

/**
 * Query for fetching the next survey question.
 * Returns the next unanswered question or generates a new AI question.
 */
export function useSurveyQuestion() {
  return useQuery({
    queryKey: queryKeys.survey.next(),
    queryFn: async () => {
      const response = await surveyNext()
      return response
    },
    staleTime: 0, // Always fetch fresh to get truly next question
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
    mutationFn: async ({ id, question, answer }: { id: string; question: string; answer: string | string[] }) => {
      const answerText = Array.isArray(answer) ? answer.join(',') : answer
      const { data, error } = await supabase
        .from('survey_answers')
        .insert({ question, answer: answerText })
        .select()
        .single()
      if (error) throw new Error(`Failed to submit survey answer: ${error.message}`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.survey.next() })
      return data
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.survey.next() })
      const prev = queryClient.getQueryData(queryKeys.survey.next())
      queryClient.setQueryData(queryKeys.survey.next(), undefined)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.survey.next(), ctx.prev)
    },
  })
}

export function useSkipSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase
        .from('survey_answers')
        .insert({ question: `skip:${id}`, answer: 'SKIPPED' })
        .select()
        .single()
      if (error) throw new Error(`Failed to skip question: ${error.message}`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.survey.next() })
      return data
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.survey.next() })
      const prev = queryClient.getQueryData(queryKeys.survey.next())
      queryClient.setQueryData(queryKeys.survey.next(), undefined)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.survey.next(), ctx.prev)
    },
  })
}

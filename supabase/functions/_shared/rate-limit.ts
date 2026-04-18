import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2.45.0'

export type UsageAction = 'ai_recs' | 'mood_search' | 'ai_survey_question'

export async function checkDailyLimit(
  supabase: SupabaseClient,
  userId: string,
  action: UsageAction,
  freeLimit: number,
  alwaysLimit?: number,
): Promise<void> {
  const { data: user } = await supabase.from('users').select('tier').eq('id', userId).single()
  const isPaid = user?.tier === 'paid'

  const limit = alwaysLimit ?? (isPaid ? Infinity : freeLimit)
  if (limit === Infinity) return

  const since = new Date()
  since.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', since.toISOString())

  if ((count ?? 0) >= limit) {
    throw new TooManyRequestsError(`Daily ${action} limit reached (${limit})`)
  }
}

export async function logUsage(
  supabase: SupabaseClient,
  userId: string,
  action: UsageAction,
): Promise<void> {
  await supabase.from('usage_logs').insert({ user_id: userId, action })
}

export class TooManyRequestsError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'TooManyRequestsError'
  }
}

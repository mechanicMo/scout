import type {
  TasteProfile,
  WatchedItem,
  Recommendation,
  SurveyQuestion,
  SurveyAnswer,
  MediaItem,
} from '@scout/shared'

export type InteractionType = 'rating' | 'dismissal' | 'survey_answer'

export interface Interaction {
  type: InteractionType
  mediaItem?: MediaItem
  overallScore?: number      // 1–5
  tags?: string[]
  dismissReason?: 'not_now' | 'already_seen' | 'not_interested'
  surveyQuestion?: string
  surveyAnswer?: string
}

export interface AIProvider {
  /**
   * Generate a ranked list of recommendations for a user.
   * @param profile - The user's full taste profile
   * @param recentHistory - Last 20 watch history items for recency signals
   */
  generateRecommendations(
    profile: TasteProfile,
    recentHistory: WatchedItem[]
  ): Promise<Recommendation[]>

  /**
   * Refine an existing recommendation list based on a natural language prompt.
   * @param message - User's free-text refinement (e.g. "something shorter")
   * @param current - The current recommendation list to refine
   * @param profile - The user's taste profile for context
   */
  refineRecommendations(
    message: string,
    current: Recommendation[],
    profile: TasteProfile
  ): Promise<Recommendation[]>

  /**
   * Generate the next survey question to fill gaps in the taste profile.
   * Returns null when the profile is sufficiently complete.
   */
  generateSurveyQuestion(
    profile: TasteProfile,
    answered: SurveyAnswer[]
  ): Promise<SurveyQuestion | null>

  /**
   * Update the taste profile after a user interaction.
   * Rewrites the structured fields and freeform notes as needed.
   */
  updateTasteProfile(
    profile: TasteProfile,
    interaction: Interaction
  ): Promise<TasteProfile>
}
